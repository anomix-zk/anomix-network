import { EncryptedNote } from "./encrypted-note";

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
    txList: {
        txHash: string,
        outputNote1: {
            data: EncryptedNote,
            index: string
        },
        outputNote2: {
            data: EncryptedNote,
            index: string
        },
        nullifier1: string,
        nullifier2: string
    }[],

    /**
     * the timestamp when this L2Block is created at Layer2
     */
    createdTs: number,

    /**
     * the timestamp when this L2Block is finalized at Layer1
     */
    finalizedTs: number
}
