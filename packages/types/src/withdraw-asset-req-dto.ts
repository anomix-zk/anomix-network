export interface WithdrawAssetReqDto {
    l1addr: string,
    noteCommitment: string,
    signature?: SignatureJSON
}

export interface SignatureJSON {
    r: string,
    s: string
}
