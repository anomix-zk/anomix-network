import { L1TxStatus } from '@anomix/types'
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'


@Entity("tb_inner_rollup_batch")
export class InnerRollupBatch {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * stringfied { innerRollupInput: string, joinSplitProof1: string, joinSplitProof2: string }
     */
    @Column()
    inputParam: string

    /**
     * blockId, ie. blockHeight, as the primary key of block table
     */
    @Column()
    blockId: number

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
