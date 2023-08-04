import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    OneToMany
} from 'typeorm'
import { L2Tx } from './l2-tx';
import { BlockStatus } from "@anomix/types";

@Entity('tb_block')
export class BlockProverOutputEntity {
    /**
     * i.e. blockHeight, should starts from 1
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

    /**
     * record each dataTreeRoot's Index on rootTree
     */
    @Column()
    dataTreeRoot1Indx: string

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

