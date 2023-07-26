import { EncryptedNote } from "./encrypted-note";

export interface EncryptedNoteInBlock {
    blockHeight: number,
    txList: { txHash: string, data: EncryptedNote[] }[],
    timestamp: number
}
