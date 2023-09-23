
import config from './lib/config';
import { getConnection, In, QueryRunner } from 'typeorm';
import { Block, MemPlL2Tx, DepositProcessorSignal, DepositTreeTrans, Task, TaskStatus, TaskType } from '@anomix/dao';
import { BaseResponse, BlockStatus, DepositProcessingSignal, DepositTreeTransStatus, L2TxStatus, RollupTaskDto, RollupTaskType, SequencerStatus } from '@anomix/types';
import { parentPort } from 'worker_threads';
import { $axiosDeposit, $axiosSeq } from './lib/api';
import { getLogger } from "./lib/logUtils";
import { initORM } from './lib/orm';
import { ActionType } from '@anomix/circuits';

let highFeeTxExit = false;
if (process.send) {
    (process.send as any)({// when it's a primary process, process.send == undefined. 
        type: 'status',
        data: 'online'
    });
}
parentPort?.postMessage({// when it's not a subThread, parentPort == null. 
    type: 'status',
    data: 'online'
});

const logger = getLogger('mempool-watcher');
logger.info('hi, I am mempool-watcher!');

await initORM();

logger.info('mempool-watcher is ready!');

let lastSeqTs = new Date().getTime();

// if parentPort != undefined/null, then it's a subThread, else it's a process.
(parentPort ?? process).on('message', async value => {
    highFeeTxExit = true;
    await mempoolWatch();
});
if (process.send) {
    (process.send as any)({// if it's a subProcess
        type: 'status',
        data: 'isReady'
    });
}
parentPort?.postMessage({// if it's a subThread
    type: 'status',
    data: 'isReady'
});

await mempoolWatch();

setInterval(mempoolWatch, 1 * 60 * 1000);// exec/1min

async function mempoolWatch() {

    logger.info('start a new round...');

    try {
        const rollupTaskDto = {
            taskType: RollupTaskType.SEQUENCE,
            index: undefined,
            payload: {}
        } as RollupTaskDto<any, any>;


        if (!highFeeTxExit && (new Date().getTime() - lastSeqTs) < 1 * 60 * 1000) {// if interval event just happens sooner after last triggerring of highFeeTx exits.
            logger.info('interval time is not enough, stop.');

            return;
        }


        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            let couldSeq = highFeeTxExit ? true : false;// highFeeTxExit, can seq!
            const mpTxList = await queryRunner.manager.find(MemPlL2Tx, { where: { status: L2TxStatus.PENDING } });

            if (mpTxList.length == 0) {
                logger.info('fetch no memplTx.');
                // return;
            }

            if (!couldSeq) {
                // 1) check maxMpTxCnt
                if (mpTxList.length >= config.maxMpTxCnt) {
                    logger.info('mpTxList.length is greater than config.maxMpTxCnt.');

                    couldSeq = true;
                }
            }

            if (!couldSeq) {
                // 2) check maxMpTxFeeSUM
                const txFeeSum = mpTxList.reduce((p, c) => {
                    return p + Number(c.txFee);
                }, 0);
                if (txFeeSum >= config.maxMpTxFeeSUM) {
                    logger.info('txFeeSum in memory pool is greater than config.maxMpTxFeeSUM.');

                    couldSeq = true;
                }
            }

            if (!couldSeq) {
                // 3) check maxBlockInterval
                const block = await queryRunner.manager.findOne(Block, {
                    where: {
                        status: BlockStatus.PENDING
                    },
                    order: { id: 'DESC' }
                });
                if (!block) {
                    logger.warn('when check maxBlockInterval, fetch no blocks!');
                    couldSeq = true;

                } else {
                    if (new Date().getTime() - block.createdAt.getTime() >= config.maxBlockInterval) {
                        logger.info('latest block.createdAt is greater than config.maxBlockInterval.');

                        couldSeq = true;
                    }
                }
            }

            if (couldSeq) {
                // check if has depositTx inside mempool, then stop depositProcessor
                let needStopDepositProcessor = mpTxList.some(tx => {
                    return tx.actionType == ActionType.DEPOSIT.toString();
                });
                if (!needStopDepositProcessor) {// check if there are other unconfirmed blocks with DEPOSIT tx
                    await queryRunner.manager.find(Block, {
                        where: {
                            status: In([BlockStatus.PENDING, BlockStatus.PROVED])  // fetch all unconfirmed-at-layer1 blocks.
                        }
                    }).then(blocks => {
                        needStopDepositProcessor = blocks.some(b => {
                            return b.depositCount > 0
                        });

                        logger.info('blocks have depositTx, set needStopDepositProcessor = ' + needStopDepositProcessor);
                    });
                }

                /**
                 * DepositProcessor gens a batch of MemplL2Tx, then it will be paused to go call AnomixEntryContract untill all L2Blocks containing depositL2Tx are confirmed at L1.
                 * * mempool-watcher is the uniform point to coordinate it.
                 */
                const depositProcessorSignal = (await queryRunner.manager.findOne(DepositProcessorSignal, { where: { id: 1 } }))!;
                if (needStopDepositProcessor) {
                    logger.info('stop depositProcessor to call AnomixEntryContract...');

                    // stop depositProcessor to call AnomixEntryContract
                    depositProcessorSignal.signal = DepositProcessingSignal.CAN_NOT_TRIGGER_CONTRACT;
                    await queryRunner.manager.save(depositProcessorSignal);

                } else {
                    logger.info('re-allow depositProcessor to call AnomixEntryContract...');

                    // allow depositProcessor to call AnomixEntryContract 
                    depositProcessorSignal.signal = DepositProcessingSignal.CAN_TRIGGER_CONTRACT;
                    await queryRunner.manager.save(depositProcessorSignal); // save before http-call below

                    logger.info('obtain the first DepositTreeTrans...');
                    // obtain the first DepositTreeTrans and trigger deposit-contract-call
                    const depositTreeTrans = await queryRunner.manager.findOne(DepositTreeTrans, {// one is enough among the period range(5mins).
                        where: {
                            status: In([DepositTreeTransStatus.PROVED])
                        },
                        order: { id: 'ASC' },
                    });

                    logger.info('obtain the first DepositTreeTrans=', depositTreeTrans?.id);
                    if (depositTreeTrans) {
                        // check if it's been just processed
                        const taskList = await queryRunner.manager.find(Task, { where: { status: TaskStatus.PENDING, taskType: TaskType.DEPOSIT } }) ?? [];
                        const rs = taskList.some(t => {
                            return t.targetId == depositTreeTrans.id
                        });

                        if (!rs) {
                            // dTran MUST align with the AnomixEntryContract's states.
                            // assert
                            // assert

                            logger.info('trigger /rollup/contract-call/', depositTreeTrans?.id);
                            await $axiosDeposit.get<BaseResponse<string>>(`/rollup/contract-call/${depositTreeTrans.id}`).then(r => {
                                if (r.data.code == 1) {
                                    throw new Error(r.data.msg);
                                }
                            });
                        }

                    }
                }

                // trigger seq
                logger.info('trigger /rollup/seq-trigger...');
                await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                    if (r.data.code == 1) {
                        logger.error(r.data.msg);
                        throw new Error(r.data.msg);
                    }
                });
            }

            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);

            console.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        logger.error(error);
    } finally {
        lastSeqTs = new Date().getTime();

        highFeeTxExit = false;

        logger.info('this round is done.');
    }
}
