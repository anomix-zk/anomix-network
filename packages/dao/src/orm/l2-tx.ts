import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity("tb_l2_tx")
export class L2Tx {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    txHash: string

    @Column()
    actionType: string

    @Column()
    nullifier1: string
    @Column()
    nullifierIdx1: string

    @Column()
    nullifier2: string
    @Column()
    nullifierIdx2: string

    @Column()
    outputNoteCommitment1: string
    /**
     * leaf index on data_tree
     */
    @Column()
    outputNoteCommitmentIdx1: string

    @Column()
    outputNoteCommitment2: string
    /**
     * leaf index on data_tree
     */
    @Column()
    outputNoteCommitmentIdx2: string

    @Column()
    publicValue: string

    @Column()
    publicOwner: string

    @Column()
    publicAssetId: string

    @Column()
    dataRoot: string

    /**
     * for deposit L2tx
     */
    @Column()
    depositRoot: string

    /**
     * leaf index of `outputNoteCommitment1` on deposit_tree
     */
    @Column()
    depositIndex: string

    @Column()
    txFee: string

    @Column()
    txFeeAssetId: string

    @Column()
    proof: string

    @Column()
    encryptedData1: string

    @Column()
    encryptedData2: string

    @Column()
    status: number

    /**
     * blockId, ie. blockHeight, as the primary key of block table
     */
    @Column()
    blockId: number

    /**
     * blockHash
     */
    @Column()
    blockHash: string

    /**
     * the index within a block
     */
    @Column()
    indexInBlock: number

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
