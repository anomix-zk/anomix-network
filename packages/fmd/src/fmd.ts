import { p256 as curve } from "@noble/curves/p256";
import * as utils from "@noble/curves/abstract/utils";
import { sha3_256 as sha256 } from "@noble/hashes/sha3";
import { concatUint8Arrays, modInverse, randomScalar } from "./utils";

const Point = curve.ProjectivePoint;
type Point = typeof Point.BASE;
// GAMMA
const NUM_KEYS = 15;

export type DetectionKey = SecretKey;

export class TaggingKey {
    private pubKeys: Uint8Array[];

    constructor(pub: Uint8Array[] = []) {
        this.pubKeys = pub;
    }
}

export class SecretKey {
    private secKeys: bigint[];

    constructor(sec: bigint[] = []) {
        this.secKeys = sec;
    }

    public static random(numKeys: number = NUM_KEYS): SecretKey {
        let secKeys: bigint[] = [];

        for (let i = 0; i < numKeys; i++) {
            secKeys.push(randomScalar(curve));
        }

        return new SecretKey(secKeys);
    }

    public getTaggingKey(): TaggingKey {
        let pubKeys: Uint8Array[] = [];

        const numKeys = this.secKeys.length;
        for (let i = 0; i < numKeys; i++) {
            pubKeys.push(curve.getPublicKey(this.secKeys[i]));
        }

        return new TaggingKey(pubKeys);
    }
}

export class Tag {
    private u: Point;
    private y: bigint;
    private bitVec: number[];

    constructor(u: Point, y: bigint, bitVec?: number[]) {
        if (bitVec === undefined) {
            bitVec = [];
        }
        this.u = u;
        this.y = y;
        this.bitVec = bitVec;
    }
}

// Generate a full keypair for an n-bit ciphertext
export function genKeypair(numKeys: number = NUM_KEYS): {
    sk: SecretKey;
    pk: TaggingKey;
} {
    let sk = SecretKey.random(numKeys);
    let pk = sk.getTaggingKey();
    return { sk, pk };
}

function computeHashH(u: Point, h: Point, w: Point): number {
    let serialized = concatUint8Arrays(u.toRawBytes(), h.toRawBytes());
    serialized = concatUint8Arrays(serialized, w.toRawBytes());

    let hash = sha256(serialized);
    return hash[0] & 0x01;
}

function computeHashG(u: Point, bitVec: number[]): bigint {
    let N = curve.CURVE.n;
    let bitSize = curve.CURVE.nBitLength;

    let serialized = concatUint8Arrays(u.toRawBytes(), new Uint8Array(bitVec));

    bitSize += 64;
    let bitsHashed = 0;
    let h = new Uint8Array();

    while (bitsHashed < bitSize) {
        let hash = sha256(serialized);
        h = concatUint8Arrays(h, hash.subarray(0, 32));
        bitsHashed = h.length / 8;

        if (bitsHashed < bitSize) {
            // Concatenate an "X" (0x58)
            serialized = concatUint8Arrays(serialized, new Uint8Array([0x58]));
        }
    }

    let result = utils.bytesToNumberBE(h) % N;
    return result;
}

// Encrypt a ciphertext
export function tag(pk: TaggingKey): Tag {
    let r = randomScalar(curve);
    let z = randomScalar(curve);

    // compute u = r * P
    let u = Point.BASE.multiply(r);
    // compute w = z * P
    let w = Point.BASE.multiply(z);
    let bitVec: number[] = [];

    const numKeys = pk.pubKeys.length;
    for (let i = 0; i < numKeys; i++) {
        // compute pkR = r * pk[i]
        let pkR = Point.fromHex(pk.pubKeys[i]).multiply(r);

        let padChar = computeHashH(u, pkR, w);
        bitVec.push((padChar ^= 0x01));
    }

    let v = computeHashG(u, bitVec);

    let y = ((z - v) * modInverse(r, curve.CURVE.n)) % curve.CURVE.n;
    if (y < 0) {
        y += curve.CURVE.n;
    }

    return new Tag(u, y, bitVec);
}

export function extract(sk: SecretKey, p: number): DetectionKey {
    let n = Math.floor(Math.log2(1 / p));

    const secKeys = sk.secKeys;
    const numKeys = secKeys.length;
    if (n > numKeys) {
        throw new Error("p is illegal");
    }

    let dsk = new SecretKey(secKeys.slice(0, n));
    return dsk;
}

export function testTag(dsk: SecretKey, tag: Tag): boolean {
    let result = true;

    const u = tag.u;
    const y = tag.y;
    const bitVec = tag.bitVec;
    const secKeys = dsk.secKeys;

    let v = computeHashG(u, bitVec);
    let z = Point.BASE.multiply(v);

    let temp = u.multiply(y);
    z = z.add(temp);

    const numKeys = secKeys.length;
    for (let i = 0; i < numKeys; i++) {
        let pkR = u.multiply(secKeys[i]);

        let padChar = computeHashH(u, pkR, z);
        let ki = bitVec[i] & 0x01;
        padChar ^= ki;

        if (padChar == 0) {
            result = false;
        }
    }

    return result;
}
