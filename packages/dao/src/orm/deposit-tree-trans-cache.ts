import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity('tb_deposit_tree_trans_cache')
export class DepositTreeTransCache {

    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    cache: string

    /**
     * * 0: deposit_tree's cached updates
     */
    @Column({ default: 0 })
    type: number

    @Column()
    dcTransId: number

    /**
     * just record
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    /**
     * just record
     */
    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}

