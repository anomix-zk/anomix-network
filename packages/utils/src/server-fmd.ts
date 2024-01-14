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

export { ServerTaggingKey as TaggingKey, ServerDetectionKey as DetectionKey, ServerTag as Tag, ServerSecretKey as SecretKey };

const Point = curve.ProjectivePoint;
type Point = typeof Point.BASE;
// GAMMA
const NUM_KEYS = 24;

class ServerTaggingKey {
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

    public generateTag(): ServerTag {
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

        return new ServerTag(u, y, bitVec);
    }
}

class ServerDetectionKey {
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

}

class ServerSecretKey {
    secKeys: bigint[];

    constructor(sec: bigint[] = []) {
        this.secKeys = sec;
    }

    public static generate(numKeys: number = NUM_KEYS): ServerSecretKey {
        let secKeys: bigint[] = [];

        for (let i = 0; i < numKeys; i++) {
            secKeys.push(randomScalar(curve));
        }

        return new ServerSecretKey(secKeys);
    }

    public getTaggingKey(): ServerTaggingKey {
        let pubKeys: Point[] = [];

        const numKeys = this.secKeys.length;
        for (let i = 0; i < numKeys; i++) {
            pubKeys.push(Point.fromPrivateKey(this.secKeys[i]));
        }

        return new ServerTaggingKey(pubKeys);
    }

    // extract a detection key for a given false positive (p = 2^-n)
    public extractDetectionKey(n: number): ServerDetectionKey {
        const secKeys = this.secKeys;
        const numKeys = secKeys.length;
        if (n > numKeys) {
            throw new Error(
                "n must be less than or equal to the number of keys"
            );
        }

        return new ServerDetectionKey(secKeys.slice(0, n));
    }
}

class ServerTag {
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
