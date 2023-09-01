import { initORM } from '@/lib/orm'
import { DepositTreeTrans, Task, TaskStatus, TaskType, } from "@anomix/dao";
import { getConnection } from 'typeorm';
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('rollup-db');

export class RollupDB {

    async start() {
        await initORM();
    }

    public async updateTreeTransAndAddWatchTask(depositTreeTrans: DepositTreeTrans) {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();
        try {
            await queryRunner.manager.save(depositTreeTrans);

            const task = new Task();
            task.txHash = depositTreeTrans.txHash;
            task.taskType = TaskType.DEPOSIT;
            task.targetId = depositTreeTrans.id;
            task.status = TaskStatus.PENDING;
            await queryRunner.manager.save(task);

            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    }
}
