import { L1TxStatus } from '@anomix/types'
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'


@Entity("tb_deposit_rollup_batch")
export class DepositRollupBatch {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * stringfied { depositRollupState: string, depositActionBatch: string }
     */
    @Column()
    inputParam: string

    /**
     * the primary key of 'DepositTreeTrans' table
     */
    @Column()
    transId: number

    /**
     * just the insert timestamp,for later statistic
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    /**
     * just the insert timestamp,for later statistic
     */
    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
