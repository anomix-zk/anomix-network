import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity('tb_block_cache')
export class BlockCache {
    /**
     * i.e. blockHeight, should starts from 1
     */
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    cache: string

    /**
     * * 0: data_tree's cached updates
     * * 1: empty leaf witness of txFee on data_tree
     */
    @Column({ default: 0 })
    type: number

    @Column()
    blockId: number

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

