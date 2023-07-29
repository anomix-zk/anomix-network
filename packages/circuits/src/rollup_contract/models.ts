import { Field, Provable, PublicKey, Struct, UInt64 } from 'snarkyjs';
import { FEE_ASSET_ID_SUPPORT_NUM } from '../constants';
import { TxFee } from '../inner_rollup/models';
import { DataMerkleWitness } from '../models/merkle_witness';
import { ValueNote } from '../models/value_note';

export class RollupState extends Struct({
  dataRoot: Field,
  nullifierRoot: Field,
  dataRootsRoot: Field,
  depositStartIndex: Field,
}) {
  toPretty(): any {
    return {
      dataRoot: this.dataRoot.toString(),
      nullifierRoot: this.nullifierRoot.toString(),
      dataRootsRoot: this.dataRootsRoot.toString(),
      depositStartIndex: this.depositStartIndex.toString(),
    };
  }
}

export class RollupStateTransition extends Struct({
  source: RollupState,
  target: RollupState,
}) {
  toPretty(): any {
    return {
      source: this.source.toPretty(),
      target: this.target.toPretty(),
    };
  }
}

export class RollupBlockEvent extends Struct({
  blockNumber: Field,
  blockHash: Field,
  rollupSize: Field,
  stateTransition: RollupStateTransition,
  depositRoot: Field,
  depositCount: Field,
  totalTxFees: Provable.Array(TxFee, FEE_ASSET_ID_SUPPORT_NUM),
  txFeeReceiver: PublicKey,
  // blockInfo: BlockProveOutput,
}) {}

export class WithdrawFundEvent extends Struct({
  receiverAddress: PublicKey,
  noteNullifier: Field,
  nullifierIndex: Field,
  amount: UInt64,
  assetId: Field,
}) {}

export class WithdrawNoteWitnessData extends Struct({
  withdrawNote: ValueNote,
  index: Field,
  witness: DataMerkleWitness,
}) {}