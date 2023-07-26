import { EncryptedNote } from "./encrypted-note";

export interface L2TxReqDto {
    proof: any
    data: {
        outputNote1: EncryptedNote,
        outputNote2: EncryptedNote,
        accountPublicKey: string,
        aliasHash: string
    }
}
