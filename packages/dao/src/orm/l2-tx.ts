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
    nullifier1_idx: string

    @Column()
    nullifier2: string
    @Column()
    nullifier2_idx: string

    @Column()
    outputNoteCommitment1: string
    @Column()
    outputNoteCommitment1_idx: string

    @Column()
    outputNoteCommitment2: string
    @Column()
    outputNoteCommitment2_idx: string

    @Column()
    publicValue: string
    @Column()
    publicOwner: string
    @Column()
    publicAssetId: string

    @Column()
    dataRoot: string
    @Column()
    depositRoot: string
    @Column()
    depositIndex: string

    @Column()
    txFee: string
    @Column()
    txFeeAssetId: string

    @Column()
    proof: string

    @Column()
    secret: string
    @Column()
    creator_pubkey: string

    @Column()
    encryptedData: string

    @Column()
    status: number

    /**
     * blockId, ie. blockHeight, as the primary key of block table
     */
    @Column()
    blockId: number

    @Column()
    indexInBlock: number

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

}
