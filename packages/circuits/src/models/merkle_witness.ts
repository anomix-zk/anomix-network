import {
  DATA_TREE_HEIGHT,
  DEPOSIT_TREE_HEIGHT,
  NULLIFIER_TREE_HEIGHT,
  ROOT_TREE_HEIGHT,
} from '../constant';
import { SiblingPath } from '@anomix/merkle-tree';
import { Field, Poseidon, Struct } from 'snarkyjs';
import { DUMMY_FIELD } from './constant';

export class DepositMerkleWitness extends SiblingPath(DEPOSIT_TREE_HEIGHT) {}

export class DataMerkleWitness extends SiblingPath(DATA_TREE_HEIGHT) {}

export class NullifierMerkleWitness extends SiblingPath(
  NULLIFIER_TREE_HEIGHT
) {}

export class RootMerkleWitness extends SiblingPath(ROOT_TREE_HEIGHT) {}

export class LeafData extends Struct({
  value: Field,
  nextValue: Field,
  nextIndex: Field,
}) {
  static zero(): LeafData {
    return new LeafData({
      value: DUMMY_FIELD,
      nextValue: DUMMY_FIELD,
      nextIndex: DUMMY_FIELD,
    });
  }

  commitment(): Field {
    return Poseidon.hash([this.value, this.nextValue, this.nextIndex]);
  }
}

export class LowLeafWitness extends Struct({
  leafData: LeafData,
  siblingPath: NullifierMerkleWitness,
  index: Field,
}) {
  static zero(zeroWitness: NullifierMerkleWitness): LowLeafWitness {
    return new LowLeafWitness({
      leafData: LeafData.zero(),
      siblingPath: zeroWitness,
      index: DUMMY_FIELD,
    });
  }

  public checkMembershipAndAssert(root: Field, msg?: string) {
    const leaf = this.leafData.commitment();
    this.siblingPath.calculateRoot(leaf, this.index).assertEquals(root, msg);
  }
}
