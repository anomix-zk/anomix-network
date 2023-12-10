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
