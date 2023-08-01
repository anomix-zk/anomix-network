import { JoinSplitOutput } from '@anomix/circuits';

export class UserPaymentTx {
  constructor(
    public readonly txHash: string,
    public readonly accountPk: string,
    public readonly actionType: string,
    public readonly publicValue: string,
    public readonly publicAssetId: string,
    public readonly publicOwner: string | undefined,
    public readonly txFee: string,
    public readonly txFeeAssetId: string,
    public readonly depositRoot: string,
    public readonly depositIndex: number,
    public readonly privateValue: string,
    public readonly privateValueAssetId: string,
    public readonly sender: string,
    public readonly receiver: string,
    public readonly isSender: boolean,
    public readonly createdTs: number,
    public readonly finalizedTs: number
  ) {}

  static from(value: {
    txHash: string;
    accountPk: string;
    actionType: string;
    publicValue: string;
    publicAssetId: string;
    publicOwner: string | undefined;
    txFee: string;
    txFeeAssetId: string;
    depositRoot: string;
    depositIndex: number;
    privateValue: string;
    privateValueAssetId: string;
    sender: string;
    receiver: string;
    isSender: boolean;
    createdTs: number;
    finalizedTs: number;
  }): UserPaymentTx {
    return new UserPaymentTx(
      value.txHash,
      value.accountPk,
      value.actionType,
      value.publicValue,
      value.publicAssetId,
      value.publicOwner,
      value.txFee,
      value.txFeeAssetId,
      value.depositRoot,
      value.depositIndex,
      value.privateValue,
      value.privateValueAssetId,
      value.sender,
      value.receiver,
      value.isSender,
      value.createdTs,
      value.finalizedTs
    );
  }

  static fromSender(
    output: JoinSplitOutput,
    accountPk: string,
    privateValue: string,
    privateValueAssetId: string,
    sender: string,
    receiver: string
  ): UserPaymentTx {
    return new UserPaymentTx(
      output.hash().toString(),
      accountPk,
      output.actionType.toString(),
      output.publicValue.toString(),
      output.publicAssetId.toString(),
      output.publicOwner.isEmpty().toBoolean()
        ? undefined
        : output.publicOwner.toBase58(),
      output.txFee.toString(),
      output.txFeeAssetId.toString(),
      output.depositRoot.toString(),
      Number(output.depositIndex.toString()),
      privateValue,
      privateValueAssetId,
      sender,
      receiver,
      true,
      0,
      0
    );
  }
}
