import { Encoding, PrivateKey, Signature } from "snarkyjs";
import { genNewKeyPairBySignature } from "./keys_helper";

const priKey = PrivateKey.random();
console.log("priKey: ", priKey.toBase58());
console.log("pubKey: ", priKey.toPublicKey().toBase58());

let sign = Signature.create(
    priKey,
    Encoding.Bijective.Fp.fromString("create anocash key")
);
console.log("sign: ", sign.toJSON());

let sign2 = Signature.create(
    priKey,
    Encoding.Bijective.Fp.fromString("create anocash key")
);
console.log("sign2: ", sign2.toJSON());

const keyPair = genNewKeyPairBySignature(sign);

console.log("keypair-privateKey: ", keyPair.privateKey.toBase58());
console.log("keypair-publicKey: ", keyPair.publicKey.toBase58());

const keyPair2 = genNewKeyPairBySignature(sign, 1n);

console.log("keypair2-privateKey: ", keyPair2.privateKey.toBase58());
console.log("keypair2-publicKey: ", keyPair2.publicKey.toBase58());

const keyPair3 = genNewKeyPairBySignature(sign, 1n);

console.log("keypair3-privateKey: ", keyPair3.privateKey.toBase58());
console.log("keypair3-publicKey: ", keyPair3.publicKey.toBase58());
