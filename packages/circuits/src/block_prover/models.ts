import { Field, Poseidon, Provable, PublicKey, Struct } from 'snarkyjs';
import { TxFee } from '../inner_rollup/models';
import { FEE_ASSET_ID_SUPPORT_NUM } from '../constant';
import { RootMerkleWitness } from '../models/merkle_witness';
import { RollupStateTransition } from '../rollup_contract/models';

export class BlockProveOutput extends Struct({
  blockHash: Field,
  rollupSize: Field,
  stateTransition: RollupStateTransition,
  depositRoot: Field,
  depositCount: Field,
  totalTxFees: Provable.Array(TxFee, FEE_ASSET_ID_SUPPORT_NUM),
  txFeeReceiver: PublicKey,
}) {
  public generateBlockHash(): Field {
    return Poseidon.hash([
      ...RollupStateTransition.toFields(this.stateTransition),
      this.depositRoot,
      this.depositCount,
      ...this.totalTxFees.map((txFee) => txFee.commitment()),
      ...this.txFeeReceiver.toFields(),
    ]);
  }
}

export class BlockProveInput extends Struct({
  depositRoot: Field,
  txFeeReceiver: PublicKey,
  oldDataRootsRoot: Field,
  rootStartIndex: Field,
  oldRootWitness: RootMerkleWitness,
}) {}
