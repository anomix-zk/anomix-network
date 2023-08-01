import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'
import { L1TxStatus } from "@anomix/types";

export class TaskType {
    /**
     * the L1tx for maintain deposit_tree root.
     */
    static get DEPOSIT(): number {
        return 0;
    }

    /**
     * the L1tx for user withdraw.
     */
    static get WITHDRAW(): number {
        return 0;
    }

    /**
     * the L1tx for RollupContract.
     */
    static get ROLLUP(): number {
        return 0;
    }
}


/**
 * mainly for L1 tx status trace of DepositContract Maintainance, RollupContract Maintaince, Withdraw Maintainance.
 * * when L1tx for DepositContract Maintainance is done, then update 'DepositTreeTrans' and all related items of table 'DepositInfo';
 * * when L1tx for RollupContract Maintainance is done, then update target item of table 'BlockProverOutputEntity';
 * * when L1tx for Withdraw Maintainance is done, then update target item of table 'WithdrawInfo';
 */
@Entity("tb_task")
export class Task {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * entity id for the target, like 'WithdrawInfo', 'BlockProverOutputEntity', 'DepositTreeTrans'
     * @optional
     */
    @Column()
    targetId: number

    /**
     * L1TxHash
     */
    @Column()
    txHash: string

    @Column()
    status: number

    @Column()
    taskType: number

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
