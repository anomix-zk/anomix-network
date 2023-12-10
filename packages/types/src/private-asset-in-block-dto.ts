import { EncryptedNote } from "./encrypted-note";
import { WithdrawInfoDto } from "./withdraw-info-dto";

export interface AssetsInBlockDto {
    blockHeight: number,
    blockHash: string,
    l1TxHash: string,

    /**
     * 1: before L1Tx is confirmed
     * 2: when L1Tx is confirmed;
     */
    status: number;

    /**
     * L2 tx list
     */
    txList: L2TxSimpleDto[],

    /**
     * the timestamp when this L2Block is created at Layer2
     */
    createdTs: number,

    /**
     * the timestamp when this L2Block is finalized at Layer1
     */
    finalizedTs: number
}

/**
 * L2 tx dto for simplifying the L2 tx to return to frontend
 */
export interface L2TxSimpleDto {
    id: number


    txHash: string


    actionType: string


    nullifier1: string

    nullifierIdx1?: string


    nullifier2: string

    nullifierIdx2?: string


    outputNoteCommitment1: string
    /**
     * leaf index on data_tree
     */
    outputNoteCommitmentIdx1?: string


    outputNoteCommitment2: string
    /**
     * leaf index on data_tree
     */
    outputNoteCommitmentIdx2?: string


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

    /**
     * the index within a block
     */
    indexInBlock?: number

}
