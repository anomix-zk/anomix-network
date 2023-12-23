import { p256 as curve } from "@noble/curves/p256";
import * as utils from "@noble/curves/abstract/utils";
import { sha256 } from "@noble/hashes/sha256";
import { modInverse, randomBigIntRange } from "./utils";

const Point = curve.ProjectivePoint;
type Point = typeof Point.BASE;
const NUM_KEYS = 15;

export class PublicKey {
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

export class SecretKey {
    numKeys: number;
    secKeys: bigint[];
    prob: number;

    constructor(numKeys: number = 0, sec: bigint[] = []) {
        this.numKeys = numKeys;
        this.secKeys = sec;
        this.prob = numKeys;
    }

    public addSecKey(sk: bigint) {
        this.secKeys.push(sk);
    }
}

class Flag {
    u: Point;
    y: bigint;
    c: number[];

    constructor(u: Point, y: bigint, c?: number[]) {
        if (c === undefined) {
            c = [];
        }
        this.u = u;
        this.y = y;
        this.c = c;
    }
}

// Generate a full keypair for an n-bit ciphertext
export function keyGen(numKeys: number = NUM_KEYS): {
    sk: SecretKey;
    pk: PublicKey;
} {
    let sk = new SecretKey(numKeys);
    let pk = new PublicKey(numKeys);

    for (let i = 0; i < numKeys; i++) {
        sk.addSecKey(
            curve.utils.normPrivateKeyToScalar(curve.utils.randomPrivateKey())
        );
        pk.addPubkey(curve.getPublicKey(sk.secKeys[i]));
    }

    return { sk, pk };
}

function randomScalar(): bigint {
    return curve.utils.normPrivateKeyToScalar(curve.utils.randomPrivateKey());
}

// Encrypt a ciphertext
export function flag(pk: PublicKey): Flag {
    let r = randomScalar();
    let z = randomScalar();

    // compute u = r * P
    let u = Point.BASE.multiply(r);
    // compute w = z * P
    let w = Point.BASE.multiply(z);
    let bitVec = new Uint8Array((pk.numKeys + 7) / 8);

    for (let i = 0; i < pk.numKeys; i++) {
        // compute pkR = r * pk[i]
        let pkR = Point.fromHex(utils.bytesToHex(pk.pubKeys[i])).multiply(r);

        let padChar = computeHashH(u, pkR, w);
        padChar ^= 0x01;

        bitVec[i / 8] |= padChar << k % 8;
    }

    let v = computeHashG(u, bitVec);

    // let m = hash_g(u.x, u.y, c);
    // let y = ((z - m) * modInverse(r, p256.CURVE.n)) % p256.CURVE.n;
    // if (y < 0) {
    //     y += p256.CURVE.n;
    // }
    // console.log("y: ", y);
    // let result = new Flag(u, y, c);
    // return result;
}

function computeHashH(u: Point, h: Point, w: Point): number {
    let serialized = concatenateUint8Arrays(u.toRawBytes(), h.toRawBytes());
    serialized = concatenateUint8Arrays(serialized, w.toRawBytes());

    let hash = sha256(serialized);
    return hash[0] & 0x01;
}

function computeHashG(u: Point, bitVec: Uint8Array): bigint {
    let N = curve.CURVE.n;
    let bitSize = curve.CURVE.nBitLength;

    let serialized = concatenateUint8Arrays(u.toRawBytes(), bitVec);

    bitSize += 64;
    let bitsHashed = 0;
    let h = new Uint8Array();

    while (bitsHashed < bitSize) {
        let hash = sha256(serialized);
        h = concatenateUint8Arrays(h, hash.subarray(0, 32));
        bitsHashed = h.length / 8;

        if (bitsHashed < bitSize) {
            // Concatenate an "X" (0x58)
            serialized = concatenateUint8Arrays(
                serialized,
                new Uint8Array([0x58])
            );
        }
    }

    let result = utils.bytesToNumberBE(h) % N;
    return result;
}

export function extract(sk: SecretKey, p: number) {
    let n = Math.floor(Math.log2(1 / p));
    //console.log("n: ", n);
    let result: bigint[] = [];

    for (let i = 0; i < n; i++) {
        result.push(sk.secKeys[i]);
    }

    let dsk = new SecretKey(n, result);
    return dsk;
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
        result = concatenateUint8Arrays(result, hashed.subarray(0, 32));
        bit_hashed = result.length / 8;

        if (bit_hashed < size) {
            str += "X";
        }
    }

    let res = utils.bytesToNumberBE(result) % p256.CURVE.n;
    return res;
}

export function test(dsk: SecretKey, f: Flag): boolean {
    let result = true;

    let keys = dsk.secKeys;
    let u = f.u;
    let y = f.y;
    let c = f.c;

    let message = hash_g(u.x, u.y, c);
    let z = Point.BASE.multiply(message);
    // console.log("u: ", BigInt("0x" + u.toHex().toString()));
    // console.log("y: ", y, y < p256.CURVE.n);
    let t = u.multiply(y);
    z = z.add(t);

    for (let i = 0; i < dsk.numKeys; i++) {
        let pkr = u.multiply(keys[i]);

        let padding = hash_h(u, pkr, z);
        padding ^= c[i] & 0x01;

        if (padding == 0) {
            result = false;
        }
    }

    return result;
}
