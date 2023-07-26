export interface WithdrawInfoDto {
    id: number;
    /**
     * hash of corresponding L2 tx
     */
    l2TxHash: string;
    secret: string;
    ownerPk: string;
    accountRequired: string;
    /**
     * could be optional
     */
    creatorPk: string;
    value: string;
    assetId: string;
    inputNullifier: string;
    noteType: string;
}
