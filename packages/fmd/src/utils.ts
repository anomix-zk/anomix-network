import { CurveFn } from "@noble/curves/abstract/weierstrass";
import * as crypto from "crypto";


export function fastPow(x: bigint, n: bigint, mod: bigint): bigint {
    let res = 1n;
    while (n > 0n) {
        if (n & 1n) res = (res * x) % mod;
        x = (x * x) % mod;
        n >>= 1n;
    }
    return res;
}

export function modInverse(a: bigint, mod: bigint): bigint {
    return fastPow(a, mod - 2n, mod);
}

export function randomScalar(curve: CurveFn): bigint {
    return curve.utils.normPrivateKeyToScalar(curve.utils.randomPrivateKey());
}

export function randomBigIntRange(min: bigint, max: bigint): bigint {
    // Convert the range to a byte length
    const range = max - min;
    const bytes = (range.toString(2).length / 8) | 0;
    let randomNumber: bigint;

    do {
        // Generate a random buffer and convert it to bigint
        const buffer = new Uint8Array(bytes + 1);
        crypto.getRandomValues(buffer);
        randomNumber =
            BigInt(
                "0x" +
                    [...buffer]
                        .map((byte) => byte.toString(16).padStart(2, "0"))
                        .join("")
            ) % range;
    } while (randomNumber > range);

    return randomNumber + min;
}
