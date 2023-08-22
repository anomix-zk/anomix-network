import { initORM } from '@/lib/orm'
import { DepositCommitment, DepositTreeTrans, Task, TaskStatus, TaskType, } from "@anomix/dao";
import { JoinSplitProof } from "@anomix/circuits";
import { getConnection } from 'typeorm';
import { Field } from "snarkyjs";

export class RollupDB {

    async start() {
        await initORM();
    }

    public async updateTreeTransAndAddWatchTask(depositTreeTrans: DepositTreeTrans) {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();
        try {
            const depositTreeTransRepo = connection.getRepository(DepositTreeTrans);
            await depositTreeTransRepo.save(depositTreeTrans);

            const taskRepo = connection.getRepository(Task);
            const task = new Task();
            task.txHash = depositTreeTrans.txHash;
            task.taskType = TaskType.DEPOSIT;
            task.targetId = depositTreeTrans.id;
            task.status = TaskStatus.PENDING;
            await taskRepo.save(task);

            await queryRunner.commitTransaction();
        } catch (error) {
            console.error(error);
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    }
}
