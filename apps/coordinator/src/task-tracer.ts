
import { getConnection } from 'typeorm';
import { Block, DepositTreeTrans, Task, TaskStatus, TaskType, WithdrawInfo } from '@anomix/dao';
import { L1TxStatus, BlockStatus, WithdrawNoteStatus } from "@anomix/types";

async function traceTasks() {
    try {
        const connection = getConnection();

        const taskRepo = connection.getRepository(Task);

        const taskList = await taskRepo.find({ where: { status: TaskStatus.PENDING } }) ?? [];

        taskList.forEach(async (task) => {
            // check if txHash is confirmed or failed
            const l1TxHash = task.txHash;
            // TODO need record the error!
            const rs: { data: { zkapp: { blockHeight: number; dateTime: string }; }; } = await fetch("https://berkeley.graphql.minaexplorer.com/", {
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

            // if Confirmed/Failed, then maintain related entites' status
            switch (task.taskType) {
                case TaskType.DEPOSIT:
                    {
                        const depositTransRepo = connection.getRepository(DepositTreeTrans);
                        await depositTransRepo.findOne({ where: { id: task.targetId } }).then(async (dt) => {
                            dt!.status = L1TxStatus.CONFIRMED;
                            await depositTransRepo.save(dt!);
                        });
                    }
                    break;
                case TaskType.ROLLUP:
                    {
                        const blockRepo = connection.getRepository(Block);
                        await blockRepo.findOne({ where: { id: task.targetId } }).then(async (b) => {
                            b!.status = BlockStatus.CONFIRMED;
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
                                w!.status = WithdrawNoteStatus.DONE;
                                w!.finalizedAt = new Date(rs.data.zkapp.dateTime);
                                await wInfoRepo.save(w!);
                            });
                        }
                    }
                    break;

                default:
                    break;
            }
        });
    } catch (error) {
        console.error(error);
    }
}

setInterval(traceTasks, 3 * 60 * 1000); // exec/3mins

