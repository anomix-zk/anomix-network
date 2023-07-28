import { BaseSiblingPath } from '@anomix/merkle-tree';
import { EncryptedNote } from '@anomix/types';
import {
  calculateShareSecret,
  derivePublicKeyBigInt,
  encrypt,
  fieldArrayToStringArray,
  genNewKeyPairForNote,
  maskReceiverBySender,
} from '@anomix/utils';
import { Bool, Field, Poseidon, PrivateKey, PublicKey } from 'snarkyjs';
import { ValueNote } from '../models/value_note';

export function checkMembership(
  leaf: Field,
  leafIndex: Field,
  witness: BaseSiblingPath,
  root: Field
) {
  const calculatedRoot = witness.calculateRoot(leaf, leafIndex);
  return calculatedRoot.equals(root);
}

export function checkMembershipAndAssert(
  leaf: Field,
  leafIndex: Field,
  witness: BaseSiblingPath,
  root: Field,
  msg?: string
) {
  checkMembership(leaf, leafIndex, witness, root).assertTrue(msg);
}

export function calculateNoteNullifier(
  commitment: Field,
  priKey: PrivateKey,
  isRealNote: Bool
): Field {
  return Poseidon.hash([
    commitment,
    Poseidon.hash(priKey.toFields()),
    isRealNote.toField(),
  ]);
}

export async function encryptValueNote(
  note: ValueNote,
  senderPrivateKey: PrivateKey
): Promise<EncryptedNote> {
  const jsonStr = JSON.stringify(ValueNote.toJSON(note));
  const noteCommitment = note.commitment();
  const privateKeyBigInt = senderPrivateKey.toBigInt();
  const noteCommitmentBigInt = noteCommitment.toBigInt();
  const publicKey = genNewKeyPairForNote(
    privateKeyBigInt,
    noteCommitmentBigInt
  ).publicKey;
  const senderPubKeyBigInt = derivePublicKeyBigInt(
    senderPrivateKey.toPublicKey()
  );
  const receiverInfo = maskReceiverBySender(
    note.ownerPk,
    senderPubKeyBigInt,
    noteCommitment.toBigInt()
  );
  const shareSecret = calculateShareSecret(senderPrivateKey, note.ownerPk);
  const cipherText = await encrypt(
    jsonStr,
    noteCommitment.toString(),
    shareSecret
  );

  return {
    noteCommitment: noteCommitment.toString(),
    publicKey: publicKey.toBase58(),
    cipherText,
    receiverInfo: fieldArrayToStringArray(receiverInfo),
  };
}
