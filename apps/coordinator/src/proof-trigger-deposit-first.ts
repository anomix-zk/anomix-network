import { $axiosDeposit, $axiosSeq } from "./lib/api";
import { getConnection, In, QueryRunner } from 'typeorm';
import { Block, DepositProcessorSignal, DepositTreeTrans, Task, TaskStatus, TaskType } from '@anomix/dao';
import { BaseResponse, BlockStatus, DepositProcessingSignal, DepositTreeTransStatus, MerkleTreeId, RollupTaskDto, RollupTaskType, SequencerStatus } from '@anomix/types';
import { getLogger } from "./lib/logUtils";
import { initORM } from "./lib/orm";
import { parentPort } from "worker_threads";

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

const logger = getLogger('proof-trigger');
logger.info('hi, I am proof-trigger!');

await initORM();

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

logger.info('proof-trigger is ready!');

const periodRange = 5 * 60 * 1000

let lastContractCallTimestamp = 0;

await proofTrigger();
setInterval(proofTrigger, periodRange); // exec/5mins

async function proofTrigger() {
    logger.info('start a new round...');

    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.startTransaction();
    try {
        const blockList = await queryRunner.manager.find(Block,
            {
                where: { status: In([BlockStatus.PENDING, BlockStatus.PROVED]) },
                order: { id: 'ASC' }
            }) ?? [];

        if (blockList.length == 0) {
            logger.info('fetch no blocks in [PENDING, PROVED].');
            return;
        }

        for (let indx = 0; indx < blockList.length; indx++) {
            const block = blockList[indx];

            logger.info(`begin process block[${block.id}]`);
            logger.info(`block.triggerProofAt: ${block.triggerProofAt?.toString()}`);

            // to avoid double computation, should exclude those blocks that triggered previously but not completed
            const timeRange = block.triggerProofAt ? (new Date().getTime() - block.triggerProofAt.getTime()) : 0;

            if (indx == 0 && block!.status == BlockStatus.PROVED) {// the lowest one with PROVED status, must be based on the onchain state inside AnomixRollupContract.
                logger.info('the lowest one with PROVED status...');

                // 1. check timeRange
                if (0 < timeRange && timeRange < periodRange * 4) {
                    logger.info(`this block was triggered previously, might not completed, skip it.`);
                    continue;
                }

                // to control the frequency of contract-call to a approprite range, to let 'Withdraw-claim' more smoothly.
                if (lastContractCallTimestamp != 0 && (new Date().getTime() - lastContractCallTimestamp) < 20 * 60 * 1000) {
                    logger.info(`lastContractCallTimestamp = ${lastContractCallTimestamp}, less than 15mins after last contract-call...`);
                    continue;
                }

                // 2. check if it  is aligned with entryContract's depositRoot
                const syncDepositTreeInfo = await $axiosDeposit.post<BaseResponse<{
                    treeId: number,
                    includeUncommit: boolean,
                    depth: number,
                    leafNum: string,
                    treeRoot: string
                }>>('/merkletree', { treeId: MerkleTreeId.SYNC_DEPOSIT_TREE, includeUncommit: false }).then(r => {
                    if (r.data.code == 1) {
                        throw new Error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                    }
                    return r.data.data!;
                });

                // block.depositRoot is the latest DEPOSIT_TREE root when creating the block as well as obtaining the witnesses of all deposit commitments,
                // rather than the one aligning with the block.depositStartIndex0.
                if (block.depositCount > 0 && block.depositRoot != syncDepositTreeInfo.treeRoot) {// means block.depositRoot is ahead of onchain depositRoot
                    // trigger entryContract.call
                    const depositProcessorSignal = (await queryRunner.manager.findOne(DepositProcessorSignal, { where: { id: 1 } }))!;

                    logger.info('re-allow depositProcessor to call AnomixEntryContract...');

                    // allow depositProcessor to call AnomixEntryContract 
                    depositProcessorSignal.signal = DepositProcessingSignal.CAN_TRIGGER_CONTRACT;
                    await queryRunner.manager.save(depositProcessorSignal); // save before http-call below

                    // obtain the first DepositTreeTrans and trigger deposit-contract-call
                    const depositTreeTransConfirmed = await queryRunner.manager.findOne(DepositTreeTrans, {// one is enough among the period range(5mins).
                        where: {
                            status: In([DepositTreeTransStatus.CONFIRMED])
                        },
                        order: { id: 'DESC' },
                    });
                    if (depositTreeTransConfirmed?.startDepositRoot != block.depositRoot) {// must check this, due to the time window between confirmed root and syncDepositTree is not updated in time
                        logger.info('obtain the first DepositTreeTrans...');
                        // obtain the first DepositTreeTrans and trigger deposit-contract-call
                        const depositTreeTransProved = await queryRunner.manager.findOne(DepositTreeTrans, {// one is enough among the period range(5mins).
                            where: {
                                status: In([DepositTreeTransStatus.PROVED])
                            },
                            order: { id: 'ASC' },
                        });

                        logger.info('obtain the first DepositTreeTrans=' + depositTreeTransProved?.id);
                        if (depositTreeTransProved) {
                            // check if it's been just processed
                            const taskList = await queryRunner.manager.find(Task, { where: { status: TaskStatus.PENDING, taskType: TaskType.DEPOSIT } }) ?? [];
                            const rs = taskList.some(t => {
                                return t.targetId == depositTreeTransProved.id && t.taskType == TaskType.DEPOSIT
                            });

                            if (!rs) {
                                // dTran MUST align with the AnomixEntryContract's states.
                                // assert
                                // assert

                                logger.info('trigger $axiosDeposit contract-call/', depositTreeTransProved?.id);
                                await $axiosDeposit.get<BaseResponse<string>>(`/rollup/contract-call/${depositTreeTransProved.id}`).then(r => {
                                    if (r.data.code == 1) {
                                        throw new Error(r.data.msg);
                                    }
                                });
                            }
                            logger.info('done.');
                            continue;
                        }
                    }

                }

                const rollupTaskDto = {
                    taskType: RollupTaskType.ROLLUP_CONTRACT_CALL,
                    index: undefined,
                    payload: { blockId: block.id }
                } as RollupTaskDto<any, any>;

                logger.info('call [$axiosSeq /rollup/proof-trigger] for ROLLUP_CONTRACT_CALL...');
                await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', rollupTaskDto).then(r => {
                    if (r.data.code == 1) {
                        logger.error(r.data.msg);
                        throw new Error(r.data.msg);
                    }
                    lastContractCallTimestamp = new Date().getTime();
                });
                logger.info('done.');

            } else if (block.status == BlockStatus.PENDING) {
                logger.info(`BlockStatus: PENDING`);

                if (0 < timeRange && timeRange < periodRange * 4) {
                    logger.info(`this block was triggered previously, might not completed, skip it.`);
                    continue;
                }

                // ======== to here, means this block was created after last triggger-round or its proving journey was interrupted unexpectedly. ========

                if (Number(block.depositCount) != 0) {
                    logger.info(`block.depositCount is equal to ${block.depositCount}`);
                    const rollupTaskDto = {
                        taskType: RollupTaskType.DEPOSIT_JOINSPLIT,
                        index: undefined,
                        payload: { blockId: block.id }
                    } as RollupTaskDto<any, any>;

                    logger.info(`call depositProcessor to exec joint-split-deposit firstly...`);
                    await $axiosDeposit.post<BaseResponse<string>>('/rollup/joint-split-deposit', rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });
                    logger.info('done.');

                } else {// mainly for non-deposit block
                    // notify rollup_processor to start innnerRollup-proof-gen
                    const rollupTaskDto = {
                        taskType: RollupTaskType.ROLLUP_PROCESS,
                        index: undefined,
                        payload: { blockId: block.id }
                    } as RollupTaskDto<any, any>;

                    logger.info(`notify rollup_processor to start innnerRollup-proof-gen...`);
                    await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });
                    logger.info('done.');
                }

                block.triggerProofAt = new Date();// update
            }

            await queryRunner.manager.save(block);
        }

        await queryRunner.commitTransaction();

    } catch (error) {
        logger.error(error);
        console.error(error);

        await queryRunner.rollbackTransaction();

    } finally {
        await queryRunner.release();

        logger.info('this round is done.');
    }
}
