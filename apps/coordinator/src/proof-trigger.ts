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
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.startTransaction();
    try {
        const blockList = await queryRunner.manager.find(Block,
            {
                where: { status: In([BlockStatus.PENDING, BlockStatus.PROVED]) },
                order: { id: 'ASC' }
            });

        blockList!.forEach(async (block, indx) => {
            if (indx == 0 && block!.status == BlockStatus.PROVED) {// the lowest one with PROVED status, must be based on the onchain state inside AnomixRollupContract.
                const rollupTaskDto = {
                    taskType: RollupTaskType.ROLLUP_CONTRACT_CALL,
                    index: undefined,
                    payload: { blockId: block.id }
                } as RollupTaskDto<any, any>;

                await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', rollupTaskDto).then(r => {
                    if (r.data.code == 1) {
                        logger.error(r.data.msg);
                        throw new Error(r.data.msg);
                    }
                });

                return;

            } else if (block.status == BlockStatus.PENDING) {
                // to avoid double computation, should exclude those blocks that triggered previously but not completed
                const timeRange = new Date().getTime() - block.createdAt.getTime();
                if (periodRange < timeRange && timeRange < periodRange * 3) {// TODO could improve: might mistake evaluate few blocks, but no worries, they will be processed at next triggger-round!
                    return;
                }

                // ======== to here, means this block was created after last triggger-round or its proving journey was interrupted unexpectedly. ========

                if (Number(block.depositCount) != 0) {
                    const rollupTaskDto = {
                        taskType: RollupTaskType.DEPOSIT_JOINSPLIT,
                        index: undefined,
                        payload: { blockId: block.id }
                    } as RollupTaskDto<any, any>;

                    await $axiosDeposit.post<BaseResponse<string>>('/rollup/joint-split-deposit', rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });

                } else {
                    // notify rollup_processor to start innnerRollup-proof-gen
                    const rollupTaskDto = {
                        taskType: RollupTaskType.ROLLUP_PROCESS,
                        index: undefined,
                        payload: { blockId: block.id }
                    } as RollupTaskDto<any, any>;

                    await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });
                }
            }
        });

    } catch (error) {
        logger.error(error);
        console.error(error);

        await queryRunner.rollbackTransaction();

    } finally {
        await queryRunner.release();
    }
}
