export class UserAccountTx {
  constructor(
    public txHash: string,
    public accountPk: string,
    public aliasHash: string,
    public alias: string | undefined,
    public newSigningPk1: string | undefined,
    public newSigningPk2: string | undefined,
    public txFee: string,
    public txFeeAssetId: string,
    public migrated: boolean,
    public block: number,
    public createdTs: number,
    public finalizedTs: number
  ) {}

  static from(value: {
    txHash: string;
    accountPk: string;
    aliasHash: string;
    alias: string | undefined;
    newSigningPk1: string | undefined;
    newSigningPk2: string | undefined;
    txFee: string;
    txFeeAssetId: string;
    migrated: boolean;
    block: number;
    createdTs: number;
    finalizedTs: number;
  }): UserAccountTx {
    return new UserAccountTx(
      value.txHash,
      value.accountPk,
      value.aliasHash,
      value.alias,
      value.newSigningPk1,
      value.newSigningPk2,
      value.txFee,
      value.txFeeAssetId,
      value.migrated,
      value.block,
      value.createdTs,
      value.finalizedTs
    );
  }
}
