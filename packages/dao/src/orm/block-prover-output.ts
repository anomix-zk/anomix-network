import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    OneToMany
} from 'typeorm'
import { L2Tx } from './l2-tx';

export class BlockStatus {
    static get FAILED(): number {// no need?
        return -1;
    }
    static get PENDING(): number {
        return 1;
    }
    static get CONFIRMED(): number {
        return 2;
    }
}

@Entity('tb_block')
export class BlockProverOutputEntity {
    /**
     * i.e. blockHeight
     */
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * the hash of the block
     */
    @Column()
    blockHash: string

    @Column()
    rollupSize: number;


    @Column()
    rootTreeRoot0: string

    @Column()
    dataTreeRoot0: string

    @Column()
    nullifierTreeRoot0: string

    @Column()
    depositStartIndex0: string


    @Column()
    rootTreeRoot1: string

    @Column()
    dataTreeRoot1: string

    @Column()
    nullifierTreeRoot1: string

    @Column()
    depositStartIndex1: string


    @Column()
    depositRoot: string

    @Column()
    depositCount: string

    /**
     * json string from: Provable.Array(TxFee, FEE_ASSET_ID_SUPPORT_NUM)
     */
    @Column()
    totalTxFees: string

    @Column()
    txFeeReceiver: string


    @Column({ default: BlockStatus.PENDING })
    status: number

    @OneToMany(type => L2Tx, (l2Tx) => l2Tx.blockId)
    l2TxList: L2Tx[]

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date
}

