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
    TaggingKey,
    DetectionKey,
    Tag,
    testTagBulk,
    generateEntangledTag,
    MAX_PRECISION,
};

const Point = curve.ProjectivePoint;
type Point = typeof Point.BASE;
// GAMMA
const MAX_PRECISION = 24;

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

function computeHashG(
    u: Point,
    precisionBits: number,
    bitVec: number[]
): bigint {
    let hash = sha3_512.create();
    hash.update(u.toRawBytes());
    hash.update(new Uint8Array([precisionBits]));
    hash.update(new Uint8Array(bitVec));
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

    public generateTag(precisionBits: number): Tag {
        if (precisionBits > MAX_PRECISION) {
            throw new Error(
                "precisionBits must be less than or equal to MAX_PRECISION: " +
                    MAX_PRECISION
            );
        }

        let r = randomScalar(curve);
        let u = Point.BASE.multiply(r);

        let z = randomScalar(curve);
        let w = Point.BASE.multiply(z);

        let preH = computePreH(u, w);
        let bitVec: number[] = [];

        for (let i = 0; i < precisionBits; i++) {
            let k_i = computePostH(preH.clone(), this.pubKeys[i].multiply(r));
            let c_i = k_i ^ 0x01;
            bitVec.push(c_i == 0x01 ? 1 : 0);
        }

        let m = computeHashG(u, precisionBits, bitVec);
        let y = mod(invert(r, curve.CURVE.n) * (z - m), curve.CURVE.n);

        return new Tag(precisionBits, u, y, bitVec);
    }
}

function testTagBulk(detectionKeys: DetectionKey[], tag: Tag): number[] {
    let u = tag.u;
    let y = tag.y;
    if (u.equals(Point.ZERO) || y === 0n) {
        return [];
    }

    let precisionBits = tag.precisionBits;
    let bitVec = tag.bitVec;
    let m = computeHashG(u, precisionBits, bitVec);
    let g = Point.BASE;

    let w = g.multiply(m);
    let temp = u.multiply(y);
    w = w.add(temp);

    let preH = computePreH(u, w);

    let results: number[] = [];
    for (let i = 0; i < detectionKeys.length; i++) {
        let result = 0;

        let secKeys = detectionKeys[i].secKeys;

        for (let j = 0; j < precisionBits; j++) {
            let pkR = u.multiply(secKeys[j]);
            let c_i = bitVec[j];
            let k_i = computePostH(preH.clone(), pkR);

            let b_i = k_i ^ c_i;
            if (b_i != 0x01) {
                break;
            }

            result += 1;
        }

        if (result == precisionBits) {
            results.push(i);
        }
    }

    return results;
}

function generateEntangledTag(
    taggingKeys: TaggingKey[],
    precisionBits: number
): Tag {
    if (precisionBits > MAX_PRECISION) {
        throw new Error(
            "precisionBits must be less than or equal to MAX_PRECISION: " +
                MAX_PRECISION
        );
    }

    let g = Point.BASE;

    let r = randomScalar(curve);
    let u = g.multiply(r);

    let taggingKeyPrecomputes: Point[][] = [];
    for (let i = 0; i < taggingKeys.length; i++) {
        let taggingKey = taggingKeys[i];
        let precompute: Point[] = [];
        for (let j = 0; j < precisionBits; j++) {
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
            if (i < precisionBits) {
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

        let m = computeHashG(u, precisionBits, bitVec);
        let y = mod(invert(r, curve.CURVE.n) * (z - m), curve.CURVE.n);

        return new Tag(precisionBits, u, y, bitVec);
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

    public static generate(): DetectionKey {
        let secKeys: bigint[] = [];

        for (let i = 0; i < MAX_PRECISION; i++) {
            secKeys.push(randomScalar(curve));
        }

        return new DetectionKey(secKeys);
    }

    public getTaggingKey(): TaggingKey {
        let pubKeys: Point[] = [];

        const numKeys = this.secKeys.length;
        for (let i = 0; i < numKeys; i++) {
            pubKeys.push(Point.fromPrivateKey(this.secKeys[i]));
        }

        return new TaggingKey(pubKeys);
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

    public testTag(tag: Tag): boolean {
        const u = tag.u;
        const y = tag.y;
        if (u.equals(Point.ZERO) || y === 0n) {
            return false;
        }

        const bitVec = tag.bitVec;
        const precisionBits = tag.precisionBits;

        const m = computeHashG(u, precisionBits, bitVec);
        const g = Point.BASE;

        let w = g.multiply(m);
        const temp = u.multiply(y);
        w = w.add(temp);

        const preH = computePreH(u, w);

        let result = 0;

        const secKeys = this.secKeys;

        for (let i = 0; i < precisionBits; i++) {
            const pkR = u.multiply(secKeys[i]);
            const c_i = bitVec[i];
            let k_i = computePostH(preH.clone(), pkR);

            let b_i = k_i ^ c_i;
            if (b_i != 0x01) {
                return false;
            }

            result += 1;
        }

        return result == precisionBits;
    }
}

class Tag {
    precisionBits: number;
    u: Point;
    y: bigint;
    bitVec: number[];

    constructor(precisionBits: number, u: Point, y: bigint, bitVec: number[]) {
        if (precisionBits > MAX_PRECISION) {
            throw new Error(
                "precisionBits must be less than or equal to MAX_PRECISION: " +
                    MAX_PRECISION
            );
        }

        this.precisionBits = precisionBits;
        this.u = u;
        this.y = y;
        this.bitVec = bitVec;
    }

    public id(): string {
        let tagBytes = concatBytes(
            new Uint8Array([this.precisionBits]),
            this.u.toRawBytes(),
            numberToBytesBE(this.y, 32),
            new Uint8Array(this.bitVec)
        );

        return bytesToHex(sha3_256(tagBytes));
    }

    public falsePositiveProbability(): number {
        return Math.pow(0.5, this.precisionBits);
    }

    public toBytes(): Uint8Array {
        return concatBytes(
            numberToBytesBE(this.precisionBits, 1),
            this.u.toRawBytes(true),
            numberToBytesBE(this.y, 32),
            new Uint8Array(this.bitVec)
        );
    }

    public static fromBytes(tagBytes: Uint8Array): Tag {
        const precisionBits = tagBytes[0];
        const u = Point.fromHex(tagBytes.slice(1, 34));
        const y = bytesToNumberBE(tagBytes.slice(34, 66));
        const bitVec = Array.from(tagBytes.slice(66));
        return new Tag(precisionBits, u, y, bitVec);
    }
}
