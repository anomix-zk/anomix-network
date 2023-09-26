import { JoinSplitOutput } from '@anomix/circuits';

export class UserPaymentTx {
  constructor(
    public txHash: string,
    public accountPk: string,
    public actionType: string,
    public publicValue: string,
    public publicAssetId: string,
    public publicOwner: string | undefined,
    public txFee: string,
    public txFeeAssetId: string,
    public depositRoot: string,
    public depositIndex: number,
    public privateValue: string,
    public privateValueAssetId: string,
    public withdrawNoteCommitment: string | undefined,
    public sender: string,
    public receiver: string,
    public isSender: boolean,
    public block: number,
    public createdTs: number,
    public finalizedTs: number
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
    withdrawNoteCommitment: string | undefined;
    sender: string;
    receiver: string;
    isSender: boolean;
    block: number;
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
      value.withdrawNoteCommitment,
      value.sender,
      value.receiver,
      value.isSender,
      value.block,
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
    receiver: string,
    withdrawNoteCommitment?: string
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
      withdrawNoteCommitment,
      sender,
      receiver,
      true,
      0,
      0,
      0
    );
  }
}
