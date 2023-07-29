
export interface AssetInBlockReqDto {
    /**
     * block height list, no requirements on sequence.
     */
    blocks: number[],
    range: {
        /**
         * less than 'end'
         */
        start: number,
        /**
         * greater than 'start'
         */
        end: number,
    },
    /**
     * @requires
     */
    flag: number
}
