export const fastPow = (x: bigint, n: bigint, mod: bigint) => {
    let res = 1n;
    while (n > 0n) {
        if (n & 1n) res = (res * x) % mod;
        x = (x * x) % mod;
        n >>= 1n;
    }
    return res;
};

export const modInverse = (a: bigint, mod: bigint) => {
    return fastPow(a, mod - 2n, mod);
};
