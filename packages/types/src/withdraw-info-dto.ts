export interface WithdrawInfoDto {
    id: number

    /**
     * from L2tx's publicOwner
     */
    ownerPk: string


    accountRequired: string

    /**
     * could be optional
     */
    creatorPk: string


    value: string


    assetId: string


    inputNullifier: string


    secret: string


    noteType: string

    /**
     * entity id of corresponding L2 tx
     */
    l2TxId: number

    /**
     * hash of corresponding L2 tx
     */
    l2TxHash: string

    /**
     * here is a unique index here
     */
    outputNoteCommitment1: string

    /**
     * the leaf index on data_tree, will be updated when L2tx is confirmed at L2's Block
     */
    outputNoteCommitmentIdx1: string

    /**
     * record the L1TxHash when it's claimed
     */
    l1TxHash: string

    /**
     * record if it has already been claimed.
     */
    status: number


    updatedAt: Date


    createdAt: Date
}