import { p256 as curve } from "@noble/curves/p256";
import {
    concatBytes,
    bytesToNumberBE,
    numberToBytesLE,
    bytesToHex,
} from "@noble/curves/abstract/utils";
import { sha3_256 as sha256 } from "@noble/hashes/sha3";
import { randomScalar } from "../utils";
import { mod, invert } from "@noble/curves/abstract/modular";

export { genKeypair, TaggingKey, DetectionKey, Tag, SecretKey };

const Point = curve.ProjectivePoint;
type Point = typeof Point.BASE;
// GAMMA
const NUM_KEYS = 24;

// Generate a full keypair for an n-bit ciphertext
function genKeypair(numKeys: number = NUM_KEYS): {
    sk: SecretKey;
    pk: TaggingKey;
} {
    const sk = SecretKey.generate(numKeys);
    const pk = sk.getTaggingKey();
    return { sk, pk };
}

function computeHashH(u: Point, h: Point, w: Point): number {
    const serialized = concatBytes(
        u.toRawBytes(),
        h.toRawBytes(),
        w.toRawBytes()
    );

    const hash = sha256(serialized);
    return hash[0] & 0x01;
}

function computeHashG(u: Point, bitVec: number[]): bigint {
    const N = curve.CURVE.n;
    let bitSize = curve.CURVE.nBitLength;

    let serialized = concatBytes(u.toRawBytes(), new Uint8Array(bitVec));

    bitSize += 64;
    let bitsHashed = 0;
    let h = new Uint8Array();

    while (bitsHashed < bitSize) {
        let hash = sha256(serialized);
        h = concatBytes(h, hash.subarray(0, 32));
        bitsHashed = h.length / 8;

        if (bitsHashed < bitSize) {
            // Concatenate an "X" (0x58)
            serialized = concatBytes(serialized, new Uint8Array([0x58]));
        }
    }

    return mod(bytesToNumberBE(h), N);
}

class TaggingKey {
    pubKeys: Point[];

    constructor(pub: Point[]) {
        this.pubKeys = pub;
    }

    public id(): string {
        let keyBytes = new Uint8Array();
        for (let i = 0; i < this.pubKeys.length; i++) {
            keyBytes = concatBytes(keyBytes, this.pubKeys[i].toRawBytes(true));
        }

        return bytesToHex(sha256(keyBytes));
    }

    public generateTag(): Tag {
        const r = randomScalar(curve);
        const z = randomScalar(curve);

        // compute u = r * P
        const u = Point.BASE.multiply(r);
        // compute w = z * P
        const w = Point.BASE.multiply(z);
        let bitVec: number[] = [];

        const numKeys = this.pubKeys.length;
        for (let i = 0; i < numKeys; i++) {
            // compute pkR = r * pk[i]
            const pkR = this.pubKeys[i].multiply(r);

            let padding = computeHashH(u, pkR, w);
            bitVec.push((padding ^= 0x01));
        }

        const v = computeHashG(u, bitVec);
        const y = mod((z - v) * invert(r, curve.CURVE.n), curve.CURVE.n);

        return new Tag(u, y, bitVec);
    }
}

class DetectionKey {
    secKeys: bigint[];

    constructor(sec: bigint[] = []) {
        this.secKeys = sec;
    }

    public id(): string {
        let keyBytes = new Uint8Array();
        for (let i = 0; i < this.secKeys.length; i++) {
            keyBytes = concatBytes(
                keyBytes,
                numberToBytesLE(this.secKeys[i], 32)
            );
        }

        return bytesToHex(sha256(keyBytes));
    }

    public falsePositiveProbability(): number {
        return 1 / Math.pow(2, this.secKeys.length);
    }

    public testTag(tag: Tag): boolean {
        let result = true;

        const u = tag.u;
        const y = tag.y;
        const bitVec = tag.bitVec;
        const secKeys = this.secKeys;

        const v = computeHashG(u, bitVec);
        let z = Point.BASE.multiply(v);
        const temp = u.multiply(y);
        z = z.add(temp);

        const numKeys = secKeys.length;
        for (let i = 0; i < numKeys; i++) {
            const pkR = u.multiply(secKeys[i]);

            let padding = computeHashH(u, pkR, z);
            const ki = bitVec[i] & 0x01;
            padding ^= ki;

            if (padding == 0) {
                result = false;
            }
        }

        return result;
    }
}

class SecretKey {
    secKeys: bigint[];

    constructor(sec: bigint[] = []) {
        this.secKeys = sec;
    }

    public static generate(numKeys: number = NUM_KEYS): SecretKey {
        let secKeys: bigint[] = [];

        for (let i = 0; i < numKeys; i++) {
            secKeys.push(randomScalar(curve));
        }

        return new SecretKey(secKeys);
    }

    public getTaggingKey(): TaggingKey {
        let pubKeys: Point[] = [];

        const numKeys = this.secKeys.length;
        for (let i = 0; i < numKeys; i++) {
            pubKeys.push(Point.fromPrivateKey(this.secKeys[i]));
        }

        return new TaggingKey(pubKeys);
    }

    // extract a detection key for a given false positive (p = 2^-n)
    public extractDetectionKey(n: number): DetectionKey {
        const secKeys = this.secKeys;
        const numKeys = secKeys.length;
        if (n > numKeys) {
            throw new Error(
                "n must be less than or equal to the number of keys"
            );
        }

        return new DetectionKey(secKeys.slice(0, n));
    }
}

class Tag {
    u: Point;
    y: bigint;
    bitVec: number[];

    constructor(u: Point, y: bigint, bitVec?: number[]) {
        if (bitVec === undefined) {
            bitVec = [];
        }
        this.u = u;
        this.y = y;
        this.bitVec = bitVec;
    }
}
