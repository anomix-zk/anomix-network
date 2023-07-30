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
    /**
     * before L1Tx is confirmed
     */
    static get PENDING(): number {
        return 1;
    }
    /**
     * when L1Tx is confirmed
     */
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

    /**
     * record the L1TxHash when it's broadcast
     */
    @Column()
    l1TxHash: string

    @Column({ default: BlockStatus.PENDING })
    status: number

    /**
     * the timestamp when L2Block is finalized at Layer1
     */
    @Column()
    finalizedAt: Date

    /**
     * just record
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    /**
     * the timestamp when L2Block is created at Layer2
     */
    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}

