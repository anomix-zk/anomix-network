import { PrivateKey, PublicKey } from "snarkyjs";

export function genNewKeyPairForNote(
    privateKeyBigInt: bigint,
    noteCommitmentBigInt: bigint
): { privateKey: PrivateKey; publicKey: PublicKey } {
    const newKeyBigInt = privateKeyBigInt & noteCommitmentBigInt;
    const newPriKey = PrivateKey.fromBigInt(newKeyBigInt);
    const newPubKey = newPriKey.toPublicKey();

    return { privateKey: newPriKey, publicKey: newPubKey };
}

export function derivePublicKeyBigInt(publicKey: PublicKey): bigint {
    return publicKey.toFields()[0].toBigInt();
}

export function calculateShareSecret(
    priKey: PrivateKey,
    otherPubKey: PublicKey
): string {
    const fields = otherPubKey.toGroup().scale(priKey.s).toFields();
    const f1 = fields[0].toBigInt();
    const f2 = fields[1].toBigInt();

    return (f1 & f2).toString();
}
