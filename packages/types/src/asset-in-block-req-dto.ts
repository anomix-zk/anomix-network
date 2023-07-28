
export interface AssetInBlockReqDto {
    blocks: number[];
    range: {
        start: number;
        end: number;
    };
    flag: number;
}
