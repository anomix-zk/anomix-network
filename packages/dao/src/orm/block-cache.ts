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

    @Column({ default: 0 })
    status: number

    /**
      * BlockCacheType {
            DATA_TREE_UPDATES,
            TX_FEE_EMPTY_LEAF_WITNESS,
            DATA_TREE_ROOT_EMPTY_LEAF_WITNESS,
            DEPOSIT_COMMITMENTS_WITNESS,
            NULLIFIER_TREE_UPDATES,
            DATA_TREE_ROOTS_TREE_UPDATES,
            INDEXDB_UPDATES,<br>
      * }
     */
    @Column()
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

