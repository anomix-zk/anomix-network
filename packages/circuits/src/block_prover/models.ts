import { RollupStateTransition } from '../rollup_contract/models';
import { Field, Poseidon, Provable, PublicKey, Struct } from 'snarkyjs';
import { TxFee } from '../inner_rollup/models';
import { ROLLUP_TX_BATCH_SIZE } from '../constant';
import { RootMerkleWitness } from '../models/merkle_witness';

export class BlockProveOutput extends Struct({
  blockId: Field,
  stateTransition: RollupStateTransition,
  depositRoot: Field,
  totalTxFees: Provable.Array(TxFee, ROLLUP_TX_BATCH_SIZE),
  txFeeReceiver: PublicKey,
}) {
  public generateBlockId(): Field {
    return Poseidon.hash([
      ...RollupStateTransition.toFields(this.stateTransition),
      this.depositRoot,
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
