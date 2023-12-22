import { bytesToBigInt } from './bigint-helpers.js';
import { randomBytes } from './random.js';

export { createField, Fp, Fq, FiniteField, p, q, mod, inverse };

// CONSTANTS

// the modulus. called `p` in most of our code.
const p = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const q = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;

// this is `t`, where p = 2^32 * t + 1
const pMinusOneOddFactor =
  0x40000000000000000000000000000000224698fc094cf91b992d30edn;
const qMinusOneOddFactor =
  0x40000000000000000000000000000000224698fc0994a8dd8c46eb21n;

// primitive roots of unity, computed as (5^t mod p). this works because 5 generates the multiplicative group mod p
const twoadicRootFp =
  0x2bce74deac30ebda362120830561f81aea322bf2b7bb7584bdad6fabd87ea32fn;
const twoadicRootFq =
  0x2de6a9b8746d3f589e5c4dfd492ae26e9bb97ea3c106f049a70e2c1102b6d05fn;

// GENERAL FINITE FIELD ALGORITHMS

function mod(x: bigint, p: bigint) {
  x = x % p;
  if (x < 0) return x + p;
  return x;
}

// modular exponentiation, a^n % p
function power(a: bigint, n: bigint, p: bigint) {
  a = mod(a, p);
  let x = 1n;
  for (; n > 0n; n >>= 1n) {
    if (n & 1n) x = mod(x * a, p);
    a = mod(a * a, p);
  }
  return x;
}

// inverting with EGCD, 1/a in Z_p
function inverse(a: bigint, p: bigint) {
  a = mod(a, p);
  if (a === 0n) return undefined;
  let b = p;
  let x = 0n;
  let y = 1n;
  let u = 1n;
  let v = 0n;
  while (a !== 0n) {
    let q = b / a;
    let r = mod(b, a);
    let m = x - u * q;
    let n = y - v * q;
    b = a;
    a = r;
    x = u;
    y = v;
    u = m;
    v = n;
  }
  if (b !== 1n) return undefined;
  return mod(x, p);
}

function sqrt(n: bigint, p: bigint, Q: bigint, c: bigint, M: bigint) {
  // https://en.wikipedia.org/wiki/Tonelli-Shanks_algorithm#The_algorithm
  // variable naming is the same as in that link ^
  // Q is what we call `t` elsewhere - the odd factor in p - 1
  // c is a known primitive root of unity
  // M is the twoadicity = exponent of 2 in factorization of p - 1
  if (n === 0n) return 0n;
  let t = power(n, (Q - 1n) >> 1n, p); // n^(Q - 1)/2
  let R = mod(t * n, p); // n^((Q - 1)/2 + 1) = n^((Q + 1)/2)
  t = mod(t * R, p); // n^((Q - 1)/2 + (Q + 1)/2) = n^Q
  while (true) {
    if (t === 1n) return R;
    // use repeated squaring to find the least i, 0 < i < M, such that t^(2^i) = 1
    let i = 0n;
    let s = t;
    while (s !== 1n) {
      s = mod(s * s, p);
      i = i + 1n;
    }
    if (i === M) return undefined; // no solution
    let b = power(c, 1n << (M - i - 1n), p); // c^(2^(M-i-1))
    M = i;
    c = mod(b * b, p);
    t = mod(t * c, p);
    R = mod(R * b, p);
  }
}

function isSquare(x: bigint, p: bigint) {
  if (x === 0n) return true;
  let sqrt1 = power(x, (p - 1n) / 2n, p);
  return sqrt1 === 1n;
}

function randomField(p: bigint, sizeInBytes: number, hiBitMask: number) {
  // strategy: find random 255-bit bigints and use the first that's smaller than p
  while (true) {
    let bytes = randomBytes(sizeInBytes);
    bytes[sizeInBytes - 1] &= hiBitMask; // zero highest bit, so we get 255 random bits
    let x = bytesToBigInt(bytes);
    if (x < p) return x;
  }
}

// SPECIALIZATIONS TO FP, FQ
// these should be mostly trivial

const Fp = createField(p, {
  oddFactor: pMinusOneOddFactor,
  twoadicRoot: twoadicRootFp,
  twoadicity: 32n,
});
const Fq = createField(q, {
  oddFactor: qMinusOneOddFactor,
  twoadicRoot: twoadicRootFq,
  twoadicity: 32n,
});
type FiniteField = ReturnType<typeof createField>;

function createField(
  p: bigint,
  constants?: { oddFactor: bigint; twoadicRoot: bigint; twoadicity: bigint }
) {
  let { oddFactor, twoadicRoot, twoadicity } =
    constants ?? computeFieldConstants(p);
  let sizeInBits = p.toString(2).length;
  let sizeInBytes = Math.ceil(sizeInBits / 8);
  let sizeHighestByte = sizeInBits - 8 * (sizeInBytes - 1);
  let hiBitMask = (1 << sizeHighestByte) - 1;

  return {
    modulus: p,
    sizeInBits,
    t: oddFactor,
    M: twoadicity,
    twoadicRoot,
    add(x: bigint, y: bigint) {
      return mod(x + y, p);
    },
    not(x: bigint, bits: number) {
      return mod(2n ** BigInt(bits) - (x + 1n), p);
    },
    negate(x: bigint) {
      return x === 0n ? 0n : p - x;
    },
    sub(x: bigint, y: bigint) {
      return mod(x - y, p);
    },
    mul(x: bigint, y: bigint) {
      return mod(x * y, p);
    },
    inverse(x: bigint) {
      return inverse(x, p);
    },
    div(x: bigint, y: bigint) {
      let yinv = inverse(y, p);
      if (yinv === undefined) return;
      return mod(x * yinv, p);
    },
    square(x: bigint) {
      return mod(x * x, p);
    },
    isSquare(x: bigint) {
      return isSquare(x, p);
    },
    sqrt(x: bigint) {
      return sqrt(x, p, oddFactor, twoadicRoot, twoadicity);
    },
    power(x: bigint, n: bigint) {
      return power(x, n, p);
    },
    dot(x: bigint[], y: bigint[]) {
      let z = 0n;
      let n = x.length;
      for (let i = 0; i < n; i++) {
        z += x[i] * y[i];
      }
      return mod(z, p);
    },
    equal(x: bigint, y: bigint) {
      return mod(x - y, p) === 0n;
    },
    isEven(x: bigint) {
      return !(x & 1n);
    },
    random() {
      return randomField(p, sizeInBytes, hiBitMask);
    },
    fromNumber(x: number) {
      return mod(BigInt(x), p);
    },
    fromBigint(x: bigint) {
      return mod(x, p);
    },
    rot(
      x: bigint,
      bits: bigint,
      direction: 'left' | 'right' = 'left',
      maxBits = 64n
    ) {
      if (direction === 'right') bits = maxBits - bits;
      let full = x << bits;
      let excess = full >> maxBits;
      let shifted = full & ((1n << maxBits) - 1n);
      return shifted | excess;
    },
    leftShift(x: bigint, bits: number, maxBitSize: number = 64) {
      let shifted = x << BigInt(bits);
      return shifted & ((1n << BigInt(maxBitSize)) - 1n);
    },
    rightShift(x: bigint, bits: number) {
      return x >> BigInt(bits);
    },
  };
}

/**
 * Compute constants to instantiate a finite field just from the modulus
 */
function computeFieldConstants(p: bigint) {
  // figure out the factorization p - 1 = 2^M * t
  let oddFactor = p - 1n;
  let twoadicity = 0n;
  while ((oddFactor & 1n) === 0n) {
    oddFactor >>= 1n;
    twoadicity++;
  }

  // find z = non-square
  // start with 2 and increment until we find one
  let z = 2n;
  while (isSquare(z, p)) z++;

  // primitive root of unity is z^t
  let twoadicRoot = power(z, oddFactor, p);

  return { oddFactor, twoadicRoot, twoadicity };
}
