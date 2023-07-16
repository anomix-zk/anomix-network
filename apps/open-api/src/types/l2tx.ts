export interface L2TxDTO {
    /**
     * The db entity id
     * @ignore
     * @TJS-type integer
     */
    id: number

    /**
     * txid from other fields
     * @requires
     */
    txId: string

    /**
     * @requires
     */
    roof_id: string
    /**
     * @requires
     */
    input_note_nullifier_A: string
    /**
     * @requires
     */
    input_note_nullifier_B: string
    /**
     * @requires
     */
    output_note_commitment_C: string
    /**
     * @requires
     */
    output_note_commitment_D: string
    /**
     * @requires
     */
    public_value: string
    /**
     * @requires
     */
    public_owner: string
    /**
     * @requires
     */
    asset_id: string

    /**
     * @requires
     */
    data_tree_root: string
    /**
     * @requires
     */
    nullifier_tree_root: string
    /**
     * @requires
     */
    tx_fee: string
    /**
     * @requires
     */
    proof: string
    /**
     * @requires
     */
    secret: string
    /**
     * @requires
     */
    creator_pubkey: string

    /**
     * @ignore
     * @TJS-type integer
     */
    status: number
    /**
     * @ignore
     */
    idxInInnerRollup: number

    /**
     * @ignore
     */
    innerRollupEntityId: string

    /**
     * @ignore
     */
    createdAt: Date
    /**
     * @ignore
     */
    updatedAt: Date
}
