import {
    Column,
    PrimaryGeneratedColumn,
    Entity,
    UpdateDateColumn
} from 'typeorm'

/**
 * record all value note's fields for withdraw
 */
@Entity("tb_withdraw_info")
export class WithdrawInfo {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * from L2tx's publicOwner
     */
    @Column()
    ownerPk: string

    @Column()
    accountRequired: string

    /**
     * could be optional
     */
    @Column()
    creatorPk: string

    @Column()
    value: string

    @Column()
    assetId: string

    @Column()
    inputNullifier: string

    @Column()
    secret: string

    @Column()
    noteType: string

    /**
     * hash of corresponding L2 tx
     */
    @Column()
    l2TxHash: string

    /**
     * here is a unique index here
     */
    @Column()
    outputNoteCommitment: string

    /**
     * the leaf index on data_tree, will be updated when L2tx is confirmed at L2's Block
     */
    @Column()
    outputNoteCommitmentIdx: string

    /**
     * the leaf index on user_nullifier_tree
     */
    @Column()
    nullifierIdx: string

    /**
     * receiverNulliferRootBefore
     */
    @Column()
    nullifierTreeRoot0: string

    /**
     * receiverNulliferRootAfter
     */
    @Column()
    nullifierTreeRoot1: string

    /**
     * record the L1TxHash when it's claimed
     */
    @Column()
    l1TxHash: string

    /**
     * store the entire L1Tx. client will fetch it later for further signatures.
     */
    @Column()
    l1TxBody: string

    /**
     * record the block height when l1Tx is created, for later checking if L1tx becomes invalid.
     */
    @Column()
    blockIdWhenL1Tx: number

    /**
     * record if it has already been claimed.
     */
    @Column({ default: 0 })
    status: number

    /**
     * the timestamp when L1Tx is finalized at Layer1
     */
    @Column()
    finalizedAt: Date

    /**
     * just record the timestamp
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    /**
     * just the timestamp when into db
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

    public valueNote() {
        return {
            secret: this.secret,
            ownerPk: this.ownerPk,
            accountRequired: this.accountRequired,
            creatorPk: this.creatorPk,
            value: this.value,
            assetId: this.assetId,
            inputNullifier: this.inputNullifier,
            noteType: this.noteType
        }

        // return ValueNote.fromJSON({
        /*
        secret: Field(this.secret),
        ownerPk: PublicKey.fromBase58(this.ownerPk),
        accountRequired: Field(this.accountRequired),
        creatorPk: PublicKey.fromBase58(this.creatorPk),
        value: UInt64.from(this.value),
        assetId: Field(this.assetId),
        inputNullifier: Field(this.inputNullifier),
        noteType: Field(this.noteType)
        */

        //});

    }
}
