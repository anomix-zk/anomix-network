import { p256, secp256r1 } from "@noble/curves/p256";
import * as utils from "@noble/curves/abstract/utils";
import { sha256 } from "@noble/hashes/sha256";

let priKey = p256.utils.randomPrivateKey();
let pubKey = p256.getPublicKey(priKey);

const Point = p256.ProjectivePoint;
type Point = typeof Point.BASE;

class PublicKey {
    numKeys: number;
    pubKeys: Uint8Array[];

    constructor(numKeys: number = 0, pub: Uint8Array[] = []) {
        this.numKeys = numKeys;
        this.pubKeys = pub;
    }

    public addPubkey(pk: Uint8Array) {
        this.pubKeys.push(pk);
    }
}

class SecretKey {
    numKeys: number;
    secKeys: Uint8Array[];

    constructor(numKeys: number = 0, sec: Uint8Array[] = []) {
        this.numKeys = numKeys;
        this.secKeys = sec;
    }

    public addSecKey(sk: Uint8Array) {
        this.secKeys.push(sk);
    }
}

class Flag {
    u: Point;
    y: number;
    c: number[];

    constructor(u: Point, y: number, c?: number[]) {
        if (c === undefined) {
            c = [];
        }
        this.u = u;
        this.y = y;
        this.c = c;
    }
}

function keyGen(numKeys = 15) {
    let sk = new SecretKey(numKeys);
    let pk = new PublicKey(numKeys);

    for (let i = 0; i < numKeys; i++) {
        sk.addSecKey(p256.utils.randomPrivateKey());
        pk.addPubkey(p256.getPublicKey(sk.secKeys[i]));
    }

    return [sk, pk];
}

function extract(sk: SecretKey, p: number) {
    let n = Math.log(1 / p) / Math.log(2);
    let result: Uint8Array[] = [];

    for (let i = 0; i < n; i++) {
        result.push(sk.secKeys[i]);
    }

    let dsk = new SecretKey(n, result);
    return dsk;
}

function flag(pk: PublicKey): Flag {
    let pubKey = pk.pubKeys;
    // tag
    let r = p256.utils.normPrivateKeyToScalar(p256.utils.randomPrivateKey());
    let u = Point.BASE.multiply(r);
    let z = p256.utils.normPrivateKeyToScalar(p256.utils.randomPrivateKey());
    let w = Point.BASE.multiply(z);

    let c: number[] = [];
    let k: number[] = [];

    for (let i = 0; i < 15; i++) {
        let x = Point.fromHex(utils.bytesToHex(pubKey[i])).x;
        let h = Point.fromPrivateKey(r).multiply(x);
        k.push(hash_h(u, h, w));
        c.push(k[i] ^ 1);
    }

    m = hash_g(u.x, u.y, c);
}

function encrypt_string(hash_string: string) {
    return sha256(hash_string);
}

function hash_h(u: Point, h: Point, w: Point) {
    let str =
        u.x.toString() +
        u.y.toString() +
        h.x.toString() +
        h.y.toString() +
        w.x.toString() +
        w.y.toString();
    return encrypt_string(str)[0] & 0x01;
}

function concatenateUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result: Uint8Array = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
}

function uint8ArrayToBigInt(bytes: Uint8Array): bigint {
    return bytes.reduce((acc, curr) => (acc << 8n) + BigInt(curr), 0n);
}

function hash_g(ux: bigint, uy: bigint, c: number[]) {
    let str = ux.toString() + uy.toString();
    for (let i = 0; i < c.length; i++) {
        str += c[i].toString();
    }

    let size = p256.CURVE.nBitLength + 64;
    let result = new Uint8Array();
    let bit_hashed = 0;

    while (bit_hashed < size) {
        let hashed = encrypt_string(str);
        result = concatenateUint8Arrays(result, hashed.slice(0, 32));
        bit_hashed = result.length / 8;

        if (bit_hashed < size) {
            str += "x";
        }
    }

    let res = uint8ArrayToBigInt(result) % p256.CURVE.n;
    return res;
}
