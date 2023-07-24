import { Field, Provable, PublicKey, Struct } from 'snarkyjs';
import { BlockProveOutput } from '../block_prover/models';
import { FEE_ASSET_ID_SUPPORT_NUM } from '../constant';
import { TxFee } from '../inner_rollup/models';

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
  // blockInfo: BlockProveOutput,
}) {}
