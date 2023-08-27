import { Field, PublicKey, Struct, UInt64 } from 'snarkyjs';
import { DataMerkleWitness } from '../models/merkle_witness';
import { ValueNote } from '../models/value_note';

export class WithdrawFundEvent extends Struct({
  receiverAddress: PublicKey,
  noteNullifier: Field,
  nullifierIndex: Field,
  receiverNulliferRootBefore: Field,
  receiverNulliferRootAfter: Field,
  amount: UInt64,
  assetId: Field,
}) {}

export class WithdrawNoteWitnessData extends Struct({
  withdrawNote: ValueNote,
  index: Field,
  witness: DataMerkleWitness,
}) {}
