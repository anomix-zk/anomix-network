import { BaseSiblingPath } from '@anomix/merkle-tree';
import { Bool, Field, Poseidon, PrivateKey, PublicKey } from 'snarkyjs';

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

export function genNewKeyPairForNote(
  privateKeyBigInt: bigint,
  noteCommitmentBigInt: bigint
): { privateKey: PrivateKey; publicKey: PublicKey } {
  const newKeyBigInt = privateKeyBigInt & noteCommitmentBigInt;
  const newPriKey = PrivateKey.fromBigInt(newKeyBigInt);
  const newPubKey = newPriKey.toPublicKey();

  return { privateKey: newPriKey, publicKey: newPubKey };
}

export function calculatePublicKeyBigInt(publicKey: PublicKey): bigint {
  return publicKey.toFields()[0].toBigInt();
}

export function calculateShareSecret(
  priKey: PrivateKey,
  otherPubKey: PublicKey
): Field {
  return Poseidon.hash(otherPubKey.toGroup().scale(priKey.s).toFields());
}
