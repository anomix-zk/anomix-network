import { EncryptedNote } from "./encrypted-note";

/**
 * used for All L2 tx scenarios
 */
export interface L2TxReqDto {
    /**
     * from execution result of Join-Split circuit
     */
    proof: any
    extraData: {
        outputNote1: EncryptedNote,
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
        withdrawNote: {
            secret: string,
            ownerPk: string,
            accountRequired: string,
            creatorPk: string,
            value: string,
            assetId: string,
            inputNullifier: string,
            noteType: string,
        }
    }
}
