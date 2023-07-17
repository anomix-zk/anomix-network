export interface MerklePathDTO {
    /**
     * @TJS-type integer
     * @requires
     */
    leafIndex: number,

    /**
     * @requires
     */
    data: string | { value: string, nextIndex: string, nextValue: string },

    /**
     * @requires
     * @items.type string
     * 
     */
    paths: string[] // TODO array.length is up to *MERKLE_TREE_HEIGHT*
}

export interface MerkleProofReqParam {
    /**
     * @requires
     */
    tree_name: 'nullifier_tree' | 'data_tree',
    /**
     * @requires
     */
    hash: string
}
