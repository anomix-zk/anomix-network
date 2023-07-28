import { EncryptedNote } from "./encrypted-note";
import { WithdrawInfoDto } from "./withdraw-info-dto";

export interface L2TxRespDto {
    id: number


    txHash: string


    actionType: string


    nullifier1: string

    nullifierIdx1: string


    nullifier2: string

    nullifierIdx2: string


    outputNoteCommitment1: string
    /**
     * leaf index on data_tree
     */
    outputNoteCommitmentIdx1: string


    outputNoteCommitment2: string
    /**
     * leaf index on data_tree
     */
    outputNoteCommitmentIdx2: string


    publicValue: string


    publicOwner: string


    publicAssetId: string


    dataRoot: string

    /**
     * for deposit L2tx
     */
    depositRoot: string

    /**
     * leaf index of `outputNoteCommitment1` on deposit_tree
     */
    depositIndex: string


    txFee: string


    txFeeAssetId: string


    proof: string

    extraData: {
        /**
         * from encryptedData1
         */
        outputNote1: EncryptedNote,
        /**
         * from encryptedData2
         */
        outputNote2: EncryptedNote,
        /**
         * used at Account Registration section
         */
        accountPublicKey: string,
        /**
         * used at Account Registration section
         */
        aliasHash: string,
        /**
         * used at Withdrawal section
         */
        withdrawNote: WithdrawInfoDto
    }

    status: number

    /**
     * blockId, ie. blockHeight, as the primary key of block table
     */
    blockId: number

    /**
     * blockHash
     */
    blockHash: string

    /**
     * the index within a block
     */
    indexInBlock: number


    updatedAt: Date


    createdAt: Date
}
