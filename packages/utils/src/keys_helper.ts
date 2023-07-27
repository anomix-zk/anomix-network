import { Poseidon, PrivateKey, PublicKey, Sign, Signature } from "snarkyjs";

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

export function genNewKeyPairBySignature(
    sign: Signature,
    index: bigint = 0n
): { privateKey: PrivateKey; publicKey: PublicKey } {
    const randomValueBigInt = Poseidon.hash(sign.toFields()).toBigInt();
    const privateKeyBigInt = randomValueBigInt & index;
    const privateKey = PrivateKey.fromBigInt(privateKeyBigInt);

    return { privateKey, publicKey: privateKey.toPublicKey() };
}
