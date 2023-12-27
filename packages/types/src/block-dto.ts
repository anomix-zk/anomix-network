export interface BlockDto {
    /**
     * i.e. blockHeight, should starts from 1
     */

    id: number

    /**
     * the hash of the block
     */

    blockHash: string


    rollupSize: number;



    rootTreeRoot0: string


    dataTreeRoot0: string


    nullifierTreeRoot0: string


    depositStartIndex0: string


    rootTreeRoot1: string


    dataTreeRoot1: string

    /**
     * record each dataTreeRoot's Index on rootTree
     */

    dataTreeRoot1Indx: string


    nullifierTreeRoot1: string


    depositStartIndex1: string



    depositRoot: string


    depositCount: number

    /**
     * json string from: Provable.Array(TxFee, FEE_ASSET_ID_SUPPORT_NUM)
     */

    totalTxFees: string


    txFeeReceiver: string


    txFeeCommitment: string

    /**
     * record the L1TxHash when it's broadcast
     */

    l1TxHash: string


    status: number

    /**
     * the timestamp when L2Block is finalized at Layer1
     */

    finalizedAt: number

    /**
     * record timestamp for each proof-gen trigger
     * * used at coordinator_proof-trigger to avoid repeatedly trigger proof-gen at a short time-window.
     */

    triggerProofAt: number


    updatedAt: number


    createdAt: number
}
