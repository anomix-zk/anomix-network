import { p256 as curve } from "@noble/curves/p256";
import {
    concatBytes,
    bytesToNumberBE,
    numberToBytesBE,
    bytesToHex,
} from "@noble/curves/abstract/utils";
import { sha3_256, sha3_512 } from "@noble/hashes/sha3";
import { randomScalar } from "../utils";
import { mod, invert, mapHashToField } from "@noble/curves/abstract/modular";

export {
    genKeypair,
    TaggingKey,
    DetectionKey,
    Tag,
    SecretKey,
    testTagBulk,
    generateEntangledTag,
    MAX_PRECISION,
};

const Point = curve.ProjectivePoint;
type Point = typeof Point.BASE;
// GAMMA
const MAX_PRECISION = 24;

// Generate a full keypair for an n-bit ciphertext
function genKeypair(numKeys: number = MAX_PRECISION): {
    sk: SecretKey;
    pk: TaggingKey;
} {
    const sk = SecretKey.generate(numKeys);
    const pk = sk.getTaggingKey();
    return { sk, pk };
}

function computePreH(u: Point, w: Point): ReturnType<typeof sha3_256.create> {
    let hash = sha3_256.create();
    hash.update(u.toRawBytes());
    hash.update(w.toRawBytes());
    return hash;
}

function computePostH(
    hash: ReturnType<typeof sha3_256.create>,
    h: Point
): number {
    hash.update(h.toRawBytes());
    const result = hash.digest();
    return result[0] & 0x01;
}

function computeHashG(u: Point, bitVec: number[]): bigint {
    let hash = sha3_512.create();
    hash.update(new Uint8Array(bitVec));
    hash.update(u.toRawBytes());
    const hashResult = hash.digest();
    return bytesToNumberBE(mapHashToField(hashResult, curve.CURVE.n));
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

        return bytesToHex(sha3_256(keyBytes));
    }

    public generateTag(): Tag {
        let r = randomScalar(curve);
        let u = Point.BASE.multiply(r);

        let z = randomScalar(curve);
        let w = Point.BASE.multiply(z);

        let preH = computePreH(u, w);
        let bitVec: number[] = [];

        const numKeys = this.pubKeys.length;
        for (let i = 0; i < numKeys; i++) {
            let k_i = computePostH(preH.clone(), this.pubKeys[i].multiply(r));
            let c_i = k_i ^ 0x01;
            bitVec.push(c_i == 0x01 ? 1 : 0);
        }

        let m = computeHashG(u, bitVec);
        let y = mod(invert(r, curve.CURVE.n) * (z - m), curve.CURVE.n);

        return new Tag(u, y, bitVec);
    }
}

function testTagBulk(detectionKeys: DetectionKey[], tag: Tag): number[] {
    if (tag.u.equals(Point.ZERO) || tag.y === 0n) {
        return [];
    }

    let m = computeHashG(tag.u, tag.bitVec);
    let g = Point.BASE;

    let u = tag.u;
    let y = tag.y;
    let w = g.multiply(m);
    let temp = u.multiply(y);
    w = w.add(temp);

    let preH = computePreH(u, w);

    let results: number[] = [];
    for (let i = 0; i < detectionKeys.length; i++) {
        let result = 0;

        let secKeys = detectionKeys[i].secKeys;
        let numKeys = secKeys.length;
        for (let j = 0; j < numKeys; j++) {
            let pkR = u.multiply(secKeys[j]);
            let c_i = tag.bitVec[j];
            let k_i = computePostH(preH.clone(), pkR);

            let b_i = k_i ^ c_i;
            if (b_i != 0x01) {
                break;
            }

            result += 1;
        }

        if (result == numKeys) {
            results.push(i);
        }
    }

    return results;
}

function generateEntangledTag(taggingKeys: TaggingKey[], n: number): Tag {
    let g = Point.BASE;

    let r = randomScalar(curve);
    let u = g.multiply(r);

    let taggingKeyPrecomputes: Point[][] = [];
    for (let i = 0; i < taggingKeys.length; i++) {
        let taggingKey = taggingKeys[i];
        let precompute: Point[] = [];
        for (let j = 0; j < taggingKey.pubKeys.length; j++) {
            precompute.push(taggingKey.pubKeys[j].multiply(r));
        }
        taggingKeyPrecomputes.push(precompute);
    }

    const f = (z: bigint): Tag | null => {
        let w = g.multiply(z);
        let preH = computePreH(u, w);
        let key: number[] = [];

        for (let i = 0; i < taggingKeyPrecomputes[0].length; i++) {
            let precompute = taggingKeyPrecomputes[0][i];
            let k_i = computePostH(preH.clone(), precompute);
            if (i < n) {
                for (let j = 1; j < taggingKeyPrecomputes.length; j++) {
                    let n_k_i = computePostH(
                        preH.clone(),
                        taggingKeyPrecomputes[j][i]
                    );
                    if (k_i != n_k_i) {
                        return null;
                    }
                }
                key.push(k_i);
            }
        }
        let bitVec: number[] = [];
        for (let i = 0; i < key.length; i++) {
            let k_i = key[i];
            let c_i = k_i ^ 0x01;
            bitVec.push(c_i == 0x01 ? 1 : 0);
        }

        let m = computeHashG(u, bitVec);
        let y = mod(invert(r, curve.CURVE.n) * (z - m), curve.CURVE.n);

        return new Tag(u, y, bitVec);
    };

    let z = randomScalar(curve);
    let tag = f(z);
    while (tag === null) {
        z = randomScalar(curve);
        tag = f(z);
    }

    return tag;
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
                numberToBytesBE(this.secKeys[i], 32)
            );
        }

        return bytesToHex(sha3_256(keyBytes));
    }

    public falsePositiveProbability(): number {
        return Math.pow(0.5, this.secKeys.length);
    }

    public testTag(tag: Tag): boolean {
        const u = tag.u;
        const y = tag.y;
        if (u.equals(Point.ZERO) || y === 0n) {
            return false;
        }

        const bitVec = tag.bitVec;

        const m = computeHashG(u, bitVec);
        const g = Point.BASE;

        let w = g.multiply(m);
        const temp = u.multiply(y);
        w = w.add(temp);

        const preH = computePreH(u, w);

        let result = 0;

        const secKeys = this.secKeys;
        const numKeys = secKeys.length;
        for (let i = 0; i < numKeys; i++) {
            const pkR = u.multiply(secKeys[i]);
            const c_i = bitVec[i];
            let k_i = computePostH(preH.clone(), pkR);

            let b_i = k_i ^ c_i;
            if (b_i != 0x01) {
                return false;
            }

            result += 1;
        }

        return result == numKeys;
    }
}

class SecretKey {
    secKeys: bigint[];

    constructor(sec: bigint[] = []) {
        this.secKeys = sec;
    }

    public static generate(numKeys: number = MAX_PRECISION): SecretKey {
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
