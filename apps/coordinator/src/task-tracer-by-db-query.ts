
import { getConnection } from 'typeorm';
import { Block, BlockCache, BlocksZkappCommands, DepositCommitment, DepositTreeTrans, MemPlL2Tx, MinaBlock, Task, TaskStatus, TaskType, WithdrawInfo, ZkappCommands } from '@anomix/dao';
import { L1TxStatus, BlockStatus, WithdrawNoteStatus, DepositStatus, L2TxStatus, DepositTreeTransStatus, BaseResponse, BlockCacheType, BlockCacheStatus } from "@anomix/types";
import { ActionType, DUMMY_FIELD, JoinSplitOutput } from '@anomix/circuits';
import { getLogger } from "./lib/logUtils";
import { $axiosDeposit, $axiosSeq } from './lib/api';
import { initORM, initOrmPg } from './lib/orm';
import { parentPort } from 'worker_threads';
import { UInt64, PublicKey, Field } from "o1js";
import config from './lib/config';

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


const logger = getLogger('task-tracer');
logger.info('hi, I am task-tracer!');


const connectionMysqlAnomix = (await initORM())!;

const connectionPgArchive = (await initOrmPg())!;

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


logger.info('task-tracer is ready!');

await traceTasksByArchiveDBQuery();

setInterval(traceTasksByArchiveDBQuery, 1 * 60 * 1000); // exec/3mins

async function traceTasksByArchiveDBQuery() {
    logger.info('start a new round...');

    const zkappCommandsRepo = connectionPgArchive.getRepository(ZkappCommands);
    const blocksZkappCommandsRepo = connectionPgArchive.getRepository(BlocksZkappCommands);
    const blocksRepo = connectionPgArchive.getRepository(MinaBlock);

    const taskList = await connectionMysqlAnomix.getRepository(Task).find({ where: { status: TaskStatus.PENDING } }) ?? [];
    for (let index = 0; index < taskList.length; index++) {
        const task = taskList[index];

        logger.info(`processing task info: [task.id: ${task.id}, task.taskType: ${task.taskType}, task.targetId:${task.targetId}]`);

        // check if txHash is confirmed or failed
        const l1TxHash = task.txHash;

        let isConfirmed = false;
        let blockTimestamp = '0';
        const zkappCommands = await zkappCommandsRepo.findOne({
            where: {
                hash: l1TxHash
            }
        });
        if (zkappCommands) {
            const blocksZkappCommands = await blocksZkappCommandsRepo.findOne({
                where: {
                    zkapp_command_id: zkappCommands.id
                }
            });

            if (blocksZkappCommands?.status == 'applied') {
                const blocks = await blocksRepo.findOne({
                    where: {
                        id: blocksZkappCommands.block_id,
                        // chain_status: 'canonical'
                    }
                });
                if (blocks) {
                    isConfirmed = true;
                    blockTimestamp = blocks.timestamp;
                }
            } else if (blocksZkappCommands?.status == 'failed') { // ie. l1tx is not included into a l1Block on MINA chain
                logger.info(`cooresponding l1tx is not included into a l1Block on MINA chain, please wait for it.`);
                logger.info(`process [task.id:${task.id}] done`);
                continue;
            }

            const queryRunner = connectionMysqlAnomix.createQueryRunner();
            await queryRunner.startTransaction();
            try {
                // to here, means task id done, even if L1tx failed.
                task.status = TaskStatus.DONE;
                await queryRunner.manager.save(task);
                logger.info('task entity is set done, and update it into db...');

                // if Confirmed, then maintain related entites' status            
                switch (task.taskType) {
                    case TaskType.DEPOSIT:
                        {
                            if (isConfirmed) {// L1TX CONFIRMED
                                const depositTrans = await queryRunner.manager.findOne(DepositTreeTrans, { where: { id: task.targetId } });

                                logger.info('update depositTrans.status = CONFIRMED...');
                                depositTrans!.status = DepositTreeTransStatus.CONFIRMED;
                                await queryRunner.manager.save(depositTrans!);
                            }
                        }
                        break;

                    case TaskType.ROLLUP:
                        {
                            logger.info('obtain related block...');
                            await queryRunner.manager.findOne(Block, { where: { id: task.targetId } }).then(async (b) => {
                                if (isConfirmed) {
                                    logger.info('update block’ status to BlockStatus.CONFIRMED');
                                    b!.status = BlockStatus.CONFIRMED;
                                    logger.info(`update block’ finalizedAt to confirmed datetime: ${blockTimestamp}`);
                                    b!.finalizedAt = new Date(Number(blockTimestamp));
                                    await queryRunner.manager.save(b!);

                                    await queryRunner.manager.update(BlockCache, { blockId: b!.id }, { status: BlockCacheStatus.CONFIRMED });

                                } else {
                                    logger.warn('ALERT: this block failed at Layer1!!!!!');// TODO extreme case, need alert operator!
                                }
                            });
                        }
                        break;

                    default:
                        break;
                }
                await queryRunner.commitTransaction();

                // trigger call
                if (isConfirmed) {
                    switch (task.taskType) {
                        case TaskType.DEPOSIT:
                            {
                                logger.info('sync deposit tree...');
                                await $axiosDeposit.get<BaseResponse<string>>(`/merkletree/sync/${task.targetId}`).then(rs => {
                                    if (rs.data.code != 0) {
                                        throw new Error(`cannot sync sync_deposit_tree, due to: [${rs.data.msg}]`);
                                    }
                                });
                                logger.info('sync deposit tree done.');
                            }
                            break;

                        case TaskType.ROLLUP:
                            {
                                // sync data tree
                                logger.info('sync data tree...');
                                await $axiosSeq.get<BaseResponse<string>>(`/merkletree/sync-data-tree`);
                                logger.info(`sync data tree done.`);
                            }
                            break;

                        default:
                            break;
                    }
                }
            } catch (error) {
                console.error(error);
                logger.error(error);
                await queryRunner.rollbackTransaction();

                throw error;
            } finally {
                await queryRunner.release();
                logger.info(`process [task.id:${task.id}] done`);
            }

        }
    }
}
