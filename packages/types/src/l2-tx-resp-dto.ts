export interface L2TxRespDto {
    /**
     * @requires
     */
    actionType: string
    /**
     * @requires
     */
    nullifier1: string
    /**
     * @requires
     */
    nullifier2: string
    /**
     * @requires
     */
    outputNoteCommitment1: string
    /**
     * @requires
     */
    outputNoteCommitment2: string
    /**
     * @requires
     */
    publicValue: string
    /**
     * @requires
     */
    publicOwner: string
    /**
     * @requires
     */
    publicAssetId: string
    /**
     * @requires
     */
    dataRoot: string
    /**
     * @requires
     */
    depositRoot: string
    /**
     * @requires
     */
    depositIndex: string
    /**
     * @requires
     */
    txFee: string
    /**
     * @requires
     */
    txFeeAssetId: string
    /**
     * string from proof.toJSON()
     * @requires
     */
    proof: string
    /**
     * optional
     * @requires
     */
    secret: string
    /**
     * optional
     */
    creator_pubkey: string
    /**
     * @requires
     */
    encryptedData: string
}
