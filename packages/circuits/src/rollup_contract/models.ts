import { Field, Struct } from 'snarkyjs';

export class RollupState extends Struct({
  dataRoot: Field,
  nullRoot: Field,
  dataRootsRoot: Field,
  depositStartIndex: Field,
}) {
  toPretty(): any {
    return {
      dataTreeRoot: this.dataRoot.toString(),
      nullRoot: this.nullRoot.toString(),
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
