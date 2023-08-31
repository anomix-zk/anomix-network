
import { getConnection } from 'typeorm';
import { Block, DepositCommitment, DepositTreeTrans, MemPlL2Tx, Task, TaskStatus, TaskType, WithdrawInfo } from '@anomix/dao';
import { L1TxStatus, BlockStatus, WithdrawNoteStatus, DepositStatus, L2TxStatus, DepositTreeTransStatus, BaseResponse } from "@anomix/types";
import { ActionType, DUMMY_FIELD } from '@anomix/circuits';
import { getLogger } from "./lib/logUtils";
import { $axiosSeq } from './lib/api';
import { initORM } from './lib/orm';

const logger = getLogger('task-tracer');

await initORM();

await traceTasks();

setInterval(traceTasks, 3 * 60 * 1000); // exec/3mins

async function traceTasks() {
    try {
        const connection = getConnection();

        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        const taskList = await queryRunner.manager.find(Task, { where: { status: TaskStatus.PENDING } }) ?? [];

        taskList.forEach(async task => {
            // check if txHash is confirmed or failed
            const l1TxHash = task.txHash;
            // TODO need record the error!
            const rs: { data: { zkapp: { blockHeight: number, dateTime: string, failureReason: string }; }; } = await fetch("https://berkeley.graphql.minaexplorer.com/", {
                "credentials": "include",
                "headers": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Content-Type": "application/json",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache"
                },
                "referrer": "https://berkeley.graphql.minaexplorer.com/",
                "body": "{\"query\":\"query MyQuery {\\n  zkapp(query: {hash: \\\"" + l1TxHash + "\\\"}) {\\n    blockHeight\\n    failureReason {\\n      failures\\n    }\\n    dateTime\\n  }\\n}\\n\",\"variables\":null,\"operationName\":\"MyQuery\"}",
                "method": "POST",
                "mode": "cors"
            }).then(v => v.json()).then(json => {
                return json;
            });

            if (rs.data.zkapp === null) { // ie. l1tx is not included into a l1Block on MINA chain
                return;
            }

            try {
                // to here, means task id done, even if L1tx failed.
                task.status = TaskStatus.DONE;
                await queryRunner.manager.save(task);

                // if Confirmed, then maintain related entites' status            
                switch (task.taskType) {
                    case TaskType.DEPOSIT:
                        {
                            const depositTrans = await queryRunner.manager.findOne(DepositTreeTrans, { where: { id: task.targetId } });

                            if (!rs.data.zkapp.failureReason) {// L1TX CONFIRMED
                                depositTrans!.status = DepositTreeTransStatus.CONFIRMED;
                                await queryRunner.manager.save(depositTrans!);

                                const vDepositTxList: MemPlL2Tx[] = [];
                                const dcList = await queryRunner.manager.find(DepositCommitment, { where: { depositTreeTransId: depositTrans!.id } });
                                dcList!.forEach(dc => {
                                    // pre-construct depositTx
                                    vDepositTxList.push({
                                        actionType: ActionType.DEPOSIT.toString(),
                                        nullifier1: DUMMY_FIELD.toString(),
                                        nullifier2: DUMMY_FIELD.toString(),
                                        outputNoteCommitment1: dc.depositNoteCommitment,
                                        outputNoteCommitment2: DUMMY_FIELD.toString(),
                                        publicValue: dc.depositValue,
                                        publicOwner: dc.sender,
                                        publicAssetId: dc.assetId,
                                        depositIndex: dc.depositNoteIndex,
                                        txFee: '0',
                                        txFeeAssetId: dc.assetId,
                                        encryptedData1: dc.encryptedNote,
                                        status: L2TxStatus.PENDING
                                    } as MemPlL2Tx);
                                });
                                await queryRunner.manager.save(dcList);

                                // insert depositTx into memorypool
                                await queryRunner.manager.save(vDepositTxList);
                            }
                        }
                        break;

                    case TaskType.ROLLUP:
                        {
                            await queryRunner.manager.findOne(Block, { where: { id: task.targetId } }).then(async (b) => {
                                b!.status = rs.data.zkapp.failureReason ? b!.status : BlockStatus.CONFIRMED;
                                b!.finalizedAt = new Date(rs.data.zkapp.dateTime);
                                await queryRunner.manager.save(b!);
                            });

                            // sync data tree
                            await $axiosSeq.get<BaseResponse<string>>(`/merkletree/sync/${task.targetId}`).then(rs => {
                                if (rs.data.code != 0) {
                                    throw new Error("cannot sync sync_data_tree!");
                                }
                            })
                        }
                        break;

                    case TaskType.WITHDRAW: // omit currently
                        {
                            await queryRunner.manager.findOne(WithdrawInfo, { where: { id: task.targetId } }).then(async (w) => {
                                w!.status = rs.data.zkapp.failureReason ? w!.status : WithdrawNoteStatus.DONE;// TODO FAILED??
                                w!.finalizedAt = new Date(rs.data.zkapp.dateTime);
                                await queryRunner.manager.save(w!);
                            });
                        }
                        break;

                    default:
                        break;
                }

                await queryRunner.commitTransaction();
            } catch (error) {
                console.error(error);
                await queryRunner.rollbackTransaction();

                throw error;
            } finally {
                await queryRunner.release();
            }
        });
    } catch (error) {
        logger.error(error);
    }
}


