export interface MerklePathDTO {
    /**
     * @TJS-type integer
     * @requires
     */
    leafIndex: number,

    /**
     * @requires
     */
    data: string,

    /**
     * @requires
     * @items.type string
     * 
     */
    paths: string[] // TODO array.length is up to *MERKLE_TREE_HEIGHT*
}
