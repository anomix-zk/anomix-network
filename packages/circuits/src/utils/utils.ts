import { BaseSiblingPath, EncryptedNote } from '@anomix/types';
import {
  calculateShareSecret,
  derivePublicKeyBigInt,
  encrypt,
  fieldArrayToStringArray,
  genNewKeyPairForNote,
  maskReceiverBySender,
} from '@anomix/utils';
import { Bool, Field, Poseidon, PrivateKey, Encoding } from 'o1js';
import { DEPOSIT_NOTE_DATA_FIELDS_LENGTH } from '../constants';
import { EncryptedNoteFieldData } from '../entry_contract/models';
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

export async function encryptValueNoteToFieldData(
  note: ValueNote,
  noteEncryptPrivateKey: PrivateKey
): Promise<EncryptedNoteFieldData> {
  const jsonStr = JSON.stringify(ValueNote.toJSON(note));
  const noteCommitment = note.commitment();
  const privateKeyBigInt = noteEncryptPrivateKey.toBigInt();
  const noteCommitmentBigInt = noteCommitment.toBigInt();
  const publicKey = genNewKeyPairForNote(
    privateKeyBigInt,
    noteCommitmentBigInt
  ).publicKey;
  const senderPubKeyBigInt = derivePublicKeyBigInt(
    noteEncryptPrivateKey.toPublicKey()
  );
  const receiverInfo = maskReceiverBySender(
    note.ownerPk,
    senderPubKeyBigInt,
    noteCommitment.toBigInt()
  );
  const shareSecret = calculateShareSecret(noteEncryptPrivateKey, note.ownerPk);
  const cipherText = await encrypt(
    jsonStr,
    noteCommitment.toString(),
    shareSecret
  );

  const encryptedNoteJsonStr = JSON.stringify({
    noteCommitment: noteCommitment.toString(),
    publicKey: publicKey.toBase58(),
    cipherText,
    receiverInfo: fieldArrayToStringArray(receiverInfo),
  });
  let data = Encoding.Bijective.Fp.fromString(encryptedNoteJsonStr);
  data = data.concat(
    Array(DEPOSIT_NOTE_DATA_FIELDS_LENGTH - data.length).fill(Field(0))
  );

  return new EncryptedNoteFieldData({ data });
}

export function getEncryptedNoteFromFieldData(
  data: EncryptedNoteFieldData
): Promise<EncryptedNote> {
  const fs = EncryptedNoteFieldData.toFields(data);
  const encryptedNoteJsonStr = Encoding.Bijective.Fp.toString(fs);
  return JSON.parse(encryptedNoteJsonStr);
}
