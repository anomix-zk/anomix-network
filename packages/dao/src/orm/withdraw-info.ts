import {
    Column,
    PrimaryGeneratedColumn,
    Entity,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm'

export class WithdrawNoteStatus {
    /**
     * its initial status
     */
    static get PENDING() {
        return 0;
    }

    /**
     * when it's claimed
     */
    static get PROCESSING() {
        return 1;
    }

    /**
     * when L1Tx is confirmed
     */
    static get DONE() {
        return 2;
    }
}

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
     * entity id of corresponding L2 tx
     */
    @Column()
    l2TxId: number

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
}
