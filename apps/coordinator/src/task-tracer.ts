
import { getConnection } from 'typeorm';
import { Block, DepositCommitment, DepositTreeTrans, MemPlL2Tx, Task, TaskStatus, TaskType, WithdrawInfo } from '@anomix/dao';
import { L1TxStatus, BlockStatus, WithdrawNoteStatus, DepositStatus, L2TxStatus, DepositTreeTransStatus } from "@anomix/types";
import { ActionType, DUMMY_FIELD } from '@anomix/circuits';

async function traceTasks() {
    try {
        const connection = getConnection();

        const taskRepo = connection.getRepository(Task);

        const taskList = await taskRepo.find({ where: { status: TaskStatus.PENDING } }) ?? [];

        taskList.forEach(async (task) => {
            // check if txHash is confirmed or failed
            const l1TxHash = task.txHash;
            // TODO need record the error!
            const rs: { data: { zkapp: { blockHeight: number, dateTime: string, failureReason: string }; }; } = await fetch("https://berkeley.graphql.minaexplorer.com/", {
                "credentials": "include",
                "headers": {
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Content-Type": "application/json",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache"
                },
                "body": `query MyQuery {\n
                            zkapp(query: {hash: "${l1TxHash}"}) {\n
                            blockHeight\n
                            dateTime\n
                            failureReason\n
                            }\n
                        }`,
                "method": "POST",
                "mode": "cors"
            }).then(v => v.json()).then(json => {
                return json;
            });

            if (rs.data.zkapp === null) { // ie. l1tx is not included into a l1Block on MINA chain
                return;
            }

            const queryRunner = connection.createQueryRunner();
            queryRunner.startTransaction();
            try {
                // to here, means task id done, even if L1tx failed.
                task.status = TaskStatus.DONE;
                taskRepo.save(task);

                // if Confirmed, then maintain related entites' status            
                switch (task.taskType) {
                    case TaskType.DEPOSIT:
                        {
                            const depositTransRepo = connection.getRepository(DepositTreeTrans);
                            const depositTrans = await depositTransRepo.findOne({ where: { id: task.targetId } });

                            if (!rs.data.zkapp.failureReason) {// L1TX CONFIRMED
                                depositTrans!.status = DepositTreeTransStatus.CONFIRMED;
                                await depositTransRepo.save(depositTrans!);

                                const dcRepo = connection.getRepository(DepositCommitment);

                                const vDepositTxList: MemPlL2Tx[] = [];
                                const dcList = await dcRepo.find({ where: { depositTreeTransId: depositTrans!.id } });
                                dcList!.forEach(dc => {
                                    dc.status = DepositStatus.MARKED;

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
                                dcRepo.save(dcList);

                                // insert depositTx into memorypool
                                const memPlL2TxRepo = connection.getRepository(MemPlL2Tx);
                                await memPlL2TxRepo.save(vDepositTxList);
                            }
                        }
                        break;

                    case TaskType.ROLLUP:
                        {
                            const blockRepo = connection.getRepository(Block);
                            await blockRepo.findOne({ where: { id: task.targetId } }).then(async (b) => {
                                b!.status = rs.data.zkapp.failureReason ? b!.status : BlockStatus.CONFIRMED;
                                b!.finalizedAt = new Date(rs.data.zkapp.dateTime);
                                await blockRepo.save(b!);
                            });

                        }
                        break;

                    case TaskType.WITHDRAW:
                        {
                            {
                                const wInfoRepo = connection.getRepository(WithdrawInfo);
                                await wInfoRepo.findOne({ where: { id: task.targetId } }).then(async (w) => {
                                    w!.status = rs.data.zkapp.failureReason ? w!.status : WithdrawNoteStatus.DONE;// TODO FAILED??
                                    w!.finalizedAt = new Date(rs.data.zkapp.dateTime);
                                    await wInfoRepo.save(w!);
                                });
                            }
                        }
                        break;

                    default:
                        break;
                }

                queryRunner.commitTransaction();
            } catch (error) {
                console.error(error);
                queryRunner.rollbackTransaction();

                throw error;
            } finally {
                queryRunner.release();
            }
        });
    } catch (error) {
        console.error(error);
    }
}

setInterval(traceTasks, 3 * 60 * 1000); // exec/3mins

