import { EncryptedNote } from "./encrypted-note";

export interface AssetsInBlockDto {
    blockHeight: number,
    txList: {
        txHash: string,
        output1: {
            data: EncryptedNote,
            index: string
        },
        output2: {
            data: EncryptedNote,
            index: string
        },
        nullifier1: string,
        nullifier2: string
    }[],
    timestamp: number
}
