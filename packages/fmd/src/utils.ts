// export const fastPow = (x: bigint, n: bigint, mod: bigint) => {
//     let res = 1n;
//     while (n > 0n) {
//         if (n & 1n) res = (res * x) % mod;
//         x = (x * x) % mod;
//         n >>= 1n;
//     }
//     return res;
// };

// export const modInverse = (a: bigint, mod: bigint) => {
//     return fastPow(a, mod - 2n, mod);
// };

export function modInverse(a: bigint, m: bigint): bigint {
    let m0 = m;
    let y = BigInt(0);
    let x = BigInt(1);

    if (m === BigInt(1)) return BigInt(0);

    while (a > 1) {
        let q = a / m;
        let t = m;

        m = a % m;
        a = t;
        t = y;

        y = x - q * y;
        x = t;
    }

    if (x < 0) x += m0;

    return x;
}
