export class UserAccountTx {
  constructor(
    public readonly txHash: string,
    public readonly accountPk: string,
    public readonly aliasHash: string,
    public readonly newSigningPk1: string | undefined,
    public readonly newSigningPk2: string | undefined,
    public readonly txFee: string,
    public readonly txFeeAssetId: string,
    public readonly migrated: boolean,
    public readonly createdTs: number,
    public readonly finalizedTs: number
  ) {}

  static from(value: {
    txHash: string;
    accountPk: string;
    aliasHash: string;
    newSigningPk1: string | undefined;
    newSigningPk2: string | undefined;
    txFee: string;
    txFeeAssetId: string;
    migrated: boolean;
    createdTs: number;
    finalizedTs: number;
  }): UserAccountTx {
    return new UserAccountTx(
      value.txHash,
      value.accountPk,
      value.aliasHash,
      value.newSigningPk1,
      value.newSigningPk2,
      value.txFee,
      value.txFeeAssetId,
      value.migrated,
      value.createdTs,
      value.finalizedTs
    );
  }
}
