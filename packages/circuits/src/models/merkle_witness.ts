import {
  DATA_TREE_HEIGHT,
  DEPOSIT_TREE_HEIGHT,
  NULLIFIER_TREE_HEIGHT,
  ROOT_TREE_HEIGHT,
} from '../constants';
import { MerkleProofDto, SiblingPath } from '@anomix/types';
import { Field, Poseidon, Provable, Struct } from 'snarkyjs';
import { DUMMY_FIELD } from './constants';

export class DepositMerkleWitness extends SiblingPath(DEPOSIT_TREE_HEIGHT) {}

export class DataMerkleWitness extends SiblingPath(DATA_TREE_HEIGHT) {
  static fromMerkleProofDTO(dto: MerkleProofDto): DataMerkleWitness {
    return new DataMerkleWitness(dto.paths.map((p) => Field(p)));
  }
}

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
    return Provable.if(
      Provable.equal(LeafData, this, LeafData.zero()),
      Field,
      DUMMY_FIELD,
      Poseidon.hash([this.value, this.nextValue, this.nextIndex])
    );
  }
}

export class LowLeafWitnessData extends Struct({
  leafData: LeafData,
  siblingPath: NullifierMerkleWitness,
  index: Field,
}) {
  static zero(zeroWitness: NullifierMerkleWitness): LowLeafWitnessData {
    return new LowLeafWitnessData({
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
