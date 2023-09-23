import { $axiosDeposit, $axiosSeq } from "./lib/api";
import { getConnection, In, QueryRunner } from 'typeorm';
import { Block, DepositProcessorSignal, DepositTreeTrans } from '@anomix/dao';
import { BaseResponse, BlockStatus, DepositProcessingSignal, DepositTreeTransStatus, RollupTaskDto, RollupTaskType, SequencerStatus } from '@anomix/types';
import { getLogger } from "./lib/logUtils";
import { initORM } from "./lib/orm";
import { parentPort } from "worker_threads";

(process.send as any)({// when it's a primary process, process.send == undefined. 
    type: 'status',
    data: 'online'
});
parentPort?.postMessage({// when it's not a subThread, parentPort == null. 
    type: 'status',
    data: 'online'
});

const logger = getLogger('proof-trigger');
logger.info('hi, I am proof-trigger!');

await initORM();

(process.send as any)({// if it's a subProcess
    type: 'status',
    data: 'isReady'
});
parentPort?.postMessage({// if it's a subThread
    type: 'status',
    data: 'isReady'
});

logger.info('proof-trigger is ready!');

const periodRange = 5 * 60 * 1000

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

        blockList!.forEach(async (block, indx) => {
            logger.info(`begin process block[${block.id}]`);
            logger.info(`block.triggerProofAt0: ${block.triggerProofAt?.toString()}`);

            // to avoid double computation, should exclude those blocks that triggered previously but not completed
            const timeRange = block.triggerProofAt ? (new Date().getTime() - block.triggerProofAt.getTime()) : 0;

            if (indx == 0 && block!.status == BlockStatus.PROVED) {// the lowest one with PROVED status, must be based on the onchain state inside AnomixRollupContract.
                logger.info('the lowest one with PROVED status...');

                if (0 < timeRange && timeRange < periodRange * 3) {
                    logger.info(`this block was triggered previously, might not completed, skip it.`);
                    return;
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
                });
                logger.info('done.');

            } else if (block.status == BlockStatus.PENDING) {
                logger.info(`BlockStatus: PENDING`);

                if (0 < timeRange && timeRange < periodRange * 4) {
                    logger.info(`this block was triggered previously, might not completed, skip it.`);
                    return;
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
            }

            block.triggerProofAt = new Date();// update
            logger.info(`block.triggerProofAt1: ${block.triggerProofAt?.toString()}`);
        });

        await queryRunner.manager.save(blockList);

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
