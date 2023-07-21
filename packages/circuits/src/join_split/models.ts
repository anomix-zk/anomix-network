import {
  DataMerkleWitness,
  DepositMerkleWitness,
} from '../models/merkle_witness';
import { ValueNote } from '../models/value_note';
import {
  Field,
  PrivateKey,
  PublicKey,
  Signature,
  Struct,
  UInt64,
} from 'snarkyjs';

export class JoinSplitOutput extends Struct({
  actionType: Field,
  outputNoteCommitment1: Field,
  outputNoteCommitment2: Field,
  nullifier1: Field,
  nullifier2: Field,
  publicValue: UInt64,
  publicOwner: PublicKey,
  publicAssetId: Field,
  dataRoot: Field,
  txFee: UInt64,
  txFeeAssetId: Field,
  // deposit
  depositRoot: Field,
  depositIndex: Field,
  //handledDepositIndex: Field,
}) {
  static zero(): JoinSplitOutput {
    return new JoinSplitOutput({
      actionType: Field(0),
      outputNoteCommitment1: Field(0),
      outputNoteCommitment2: Field(0),
      nullifier1: Field(0),
      nullifier2: Field(0),
      publicValue: UInt64.zero,
      publicOwner: PublicKey.empty(),
      publicAssetId: Field(0),
      dataRoot: Field(0),
      txFee: UInt64.zero,
      txFeeAssetId: Field(0),
      depositRoot: Field(0),
      depositIndex: Field(0),
    });
  }
}

export class JoinSplitDepositInput extends Struct({
  publicValue: UInt64,
  publicOwner: PublicKey,
  publicAssetId: Field,
  dataRoot: Field,
  depositRoot: Field,
  //handledDepositIndex: Field,
  depositNoteCommitment: Field,
  depositNoteIndex: Field,
  depositWitness: DepositMerkleWitness,
}) {}

// transfer and withdraw
export class JoinSplitSendInput extends Struct({
  actionType: Field,
  assetId: Field,
  inputNotesNum: Field,
  inputNote1Index: Field,
  inputNote2Index: Field,
  inputNote1Witness: DataMerkleWitness,
  inputNote2Witness: DataMerkleWitness,
  inputNote1: ValueNote,
  inputNote2: ValueNote,
  outputNote1: ValueNote,
  outputNote2: ValueNote,
  aliasHash: Field,
  accountPrivateKey: PrivateKey,
  accountRequired: Field,
  accountNoteIndex: Field,
  accountNoteWitness: DataMerkleWitness,
  signingPk: PublicKey,
  signature: Signature,
  dataRoot: Field,
  publicValue: UInt64,
  publicOwner: PublicKey,
}) {}

export class JoinSplitAccountInput extends Struct({
  accountPk: PublicKey,
  newAccountPk: PublicKey,
  signingPk: PublicKey,
  signature: Signature,
  newSigningPk1: PublicKey,
  newSigningPk2: PublicKey,
  aliasHash: Field,
  operationType: Field,
  accountNoteIndex: Field,
  accountNoteWitness: DataMerkleWitness,
  dataRoot: Field,
}) {}
