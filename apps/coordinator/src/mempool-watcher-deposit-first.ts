
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
