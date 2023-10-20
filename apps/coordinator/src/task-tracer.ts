
import { getConnection } from 'typeorm';
import { Block, BlockCache, DepositCommitment, DepositTreeTrans, MemPlL2Tx, Task, TaskStatus, TaskType, WithdrawInfo } from '@anomix/dao';
import { L1TxStatus, BlockStatus, WithdrawNoteStatus, DepositStatus, L2TxStatus, DepositTreeTransStatus, BaseResponse, BlockCacheType, BlockCacheStatus } from "@anomix/types";
import { ActionType, DUMMY_FIELD, JoinSplitOutput } from '@anomix/circuits';
import { getLogger } from "./lib/logUtils";
import { $axiosDeposit, $axiosSeq } from './lib/api';
import { initORM } from './lib/orm';
import { parentPort } from 'worker_threads';
import { UInt64, PublicKey, Field } from "o1js";

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


logger.info('task-tracer is ready!');

await traceTasks();

setInterval(traceTasks, 1 * 60 * 1000); // exec/3mins

async function traceTasks() {
    logger.info('start a new round...');

    const connection = getConnection();

    const taskList = await connection.getRepository(Task).find({ where: { status: TaskStatus.PENDING } }) ?? [];
    for (let index = 0; index < taskList.length; index++) {
        const task = taskList[index];

        logger.info(`processing task info: [task.id: ${task.id}, task.taskType: ${task.taskType}, task.targetId:${task.targetId}]`);

        // check if txHash is confirmed or failed
        const l1TxHash = task.txHash;
        // TODO need record the error!
        const rs: { data: { zkapp: { blockHeight: number, dateTime: string, failureReason: string }; }; } = await fetch("https://berkeley.graphql.minaexplorer.com/", {
            "headers": {
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/json",
            },
            "referrer": "https://berkeley.graphql.minaexplorer.com/",
            "body": "{\"query\":\"query MyQuery {\\n  zkapp(query: {hash: \\\"" + l1TxHash + "\\\"}) {\\n    blockHeight\\n    failureReason {\\n      failures\\n    }\\n    dateTime\\n  }\\n}\\n\",\"variables\":null,\"operationName\":\"MyQuery\"}",
            "method": "POST",
            "mode": "cors"
        }).then(v => v.json()).then(json => {
            return json;
        });

        if (rs.data.zkapp === null) { // ie. l1tx is not included into a l1Block on MINA chain
            logger.info(`cooresponding l1tx is not included into a l1Block on MINA chain, please wait for it.`);
            logger.info(`process [task.id:${task.id}] done`);
            continue;
        }

        const queryRunner = connection.createQueryRunner();
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
                        if (!rs.data.zkapp.failureReason) {// L1TX CONFIRMED
                            const depositTrans = await queryRunner.manager.findOne(DepositTreeTrans, { where: { id: task.targetId } });

                            logger.info('update depositTrans.status = CONFIRMED...');
                            depositTrans!.status = DepositTreeTransStatus.CONFIRMED;
                            await queryRunner.manager.save(depositTrans!);
                            /*
                            logger.info('obtain related DepositCommitment list...');
                            const vDepositTxList: MemPlL2Tx[] = [];
                            const dcList = await queryRunner.manager.find(DepositCommitment, { where: { depositTreeTransId: depositTrans!.id } });

                            dcList!.forEach(dc => {
                                const memPlL2Tx = new MemPlL2Tx();
                                memPlL2Tx.actionType = ActionType.DEPOSIT.toString();
                                memPlL2Tx.nullifier1 = DUMMY_FIELD.toString();
                                memPlL2Tx.nullifier2 = DUMMY_FIELD.toString();
                                memPlL2Tx.outputNoteCommitment1 = dc.depositNoteCommitment;
                                memPlL2Tx.outputNoteCommitment2 = DUMMY_FIELD.toString();
                                memPlL2Tx.publicValue = dc.depositValue;
                                memPlL2Tx.publicOwner = dc.sender;
                                memPlL2Tx.publicAssetId = dc.assetId;
                                memPlL2Tx.dataRoot = '0';
                                memPlL2Tx.depositRoot = '0';
                                memPlL2Tx.depositIndex = dc.depositNoteIndex;
                                memPlL2Tx.txFee = '0';
                                memPlL2Tx.txFeeAssetId = dc.assetId;
                                memPlL2Tx.encryptedData1 = dc.encryptedNote;
                                memPlL2Tx.status = L2TxStatus.PENDING
                                memPlL2Tx.txHash = new JoinSplitOutput({
                                    actionType: ActionType.DEPOSIT,
                                    outputNoteCommitment1: Field(memPlL2Tx.outputNoteCommitment1),
                                    outputNoteCommitment2: DUMMY_FIELD,
                                    nullifier1: DUMMY_FIELD,
                                    nullifier2: DUMMY_FIELD,
                                    publicValue: UInt64.zero,
                                    publicOwner: PublicKey.fromBase58(memPlL2Tx.publicOwner),
                                    publicAssetId: Field(memPlL2Tx.publicAssetId),
                                    dataRoot: DUMMY_FIELD,
                                    txFee: UInt64.zero,
                                    txFeeAssetId: Field(memPlL2Tx.txFeeAssetId),
                                    depositRoot: DUMMY_FIELD,
                                    depositIndex: Field(memPlL2Tx.depositIndex),
                                }).hash().toString();

                                // pre-construct depositTx
                                vDepositTxList.push(memPlL2Tx);
                            });

                            logger.info('transform related DepositCommitment list into MemPlL2Tx list...');
                            // insert depositTx into memorypool
                            await queryRunner.manager.save(vDepositTxList);
                            */
                        }
                    }
                    break;

                case TaskType.ROLLUP:
                    {
                        logger.info('obtain related block...');
                        await queryRunner.manager.findOne(Block, { where: { id: task.targetId } }).then(async (b) => {
                            if (!rs.data.zkapp.failureReason) {
                                logger.info('update block’ status to BlockStatus.CONFIRMED');
                                b!.status = BlockStatus.CONFIRMED;
                                logger.info(`update block’ finalizedAt to confirmed datetime: ${rs.data.zkapp.dateTime}`);
                                b!.finalizedAt = new Date(rs.data.zkapp.dateTime);
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
            if (!rs.data.zkapp.failureReason) {
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
