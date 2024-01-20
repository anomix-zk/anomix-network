/**
 * Convert a little-endian buffer into a BigInt.
 * @param buf - The little-endian buffer to convert.
 * @returns A BigInt with the little-endian representation of buf.
 */
export function toBigIntLE(buf: Buffer): bigint {
  const reversed = Buffer.from(buf);
  reversed.reverse();
  const hex = reversed.toString('hex');
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt(`0x${hex}`);
}

/**
 * Convert a BigInt to a little-endian buffer.
 * @param num - The BigInt to convert.
 * @param width - The number of bytes that the resulting buffer should be.
 * @returns A little-endian buffer representation of num.
 */
export function toBufferLE(num: bigint, width: number): Buffer {
  const hex = num.toString(16);
  const buffer = Buffer.from(
    hex.padStart(width * 2, '0').slice(0, width * 2),
    'hex'
  );
  buffer.reverse();
  return buffer;
}

/**
 * Convert a big-endian buffer into a BigInt.
 * @param buf - The big-endian buffer to convert.
 * @returns A BigInt with the big-endian representation of buf.
 */
export function toBigIntBE(buf: Buffer): bigint {
  const hex = buf.toString('hex');
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt(`0x${hex}`);
}

/**
 * Convert a BigInt to a big-endian buffer.
 * @param num - The BigInt to convert.
 * @param width - The number of bytes that the resulting buffer should be.
 * @returns A big-endian buffer representation of num.
 */
export function toBufferBE(num: bigint, width: number): Buffer {
  const hex = num.toString(16);
  const buffer = Buffer.from(
    hex.padStart(width * 2, '0').slice(0, width * 2),
    'hex'
  );
  if (buffer.length > width)
    throw new Error(`Number ${num.toString(16)} does not fit in ${width}`);
  return buffer;
}

export function int256ToUint8ArrayBE(n: bigint, width = 32): Uint8Array {
  const buf = new Uint8Array(width); // 256 bits = 32 bytes

  for (let i = 0; i < 32; i++) {
    buf[31 - i] = Number(n & BigInt(0xff));
    n >>= BigInt(8);
  }

  return buf;
}

export function Uint8ArrayToInt256BE(buf: Uint8Array): bigint {
  let bigIntValue = BigInt(0);
  for (let i = 0; i < buf.length; i++) {
    bigIntValue = (bigIntValue << BigInt(8)) | BigInt(buf[i]);
  }
  return bigIntValue;
}

export function int256ToUint8ArrayLE(n: bigint, width = 32): Uint8Array {
  const buf = new Uint8Array(width); // 256 bits = 32 bytes

  for (let i = 0; i < 32; i++) {
    buf[i] = Number(n & BigInt(0xff));
    n >>= BigInt(8);
  }

  return buf;
}

export function Uint8ArrayToInt256LE(buf: Uint8Array): bigint {
  let bigIntValue = BigInt(0);
  for (let i = buf.length - 1; i >= 0; i--) {
    bigIntValue = (bigIntValue << BigInt(8)) | BigInt(buf[i]);
  }
  return bigIntValue;
}

export function writeUInt32LE(
  array: Uint8Array,
  value: number,
  offset = 0
): Uint8Array {
  array[offset] = value & 0xff;
  array[offset + 1] = (value >> 8) & 0xff;
  array[offset + 2] = (value >> 16) & 0xff;
  array[offset + 3] = (value >> 24) & 0xff;

  return array;
}

export function readUInt32LE(array: Uint8Array, offset = 0): number {
  return (
    (array[offset] |
      (array[offset + 1] << 8) |
      (array[offset + 2] << 16) |
      (array[offset + 3] << 24)) >>>
    0
  );
}

export function copyUint8Array(
  source: Uint8Array,
  target: Uint8Array,
  targetStart = 0,
  sourceStart = 0,
  sourceEnd?: number
): Uint8Array {
  if (sourceEnd === undefined) {
    sourceEnd = source.length;
  }

  for (
    let i = sourceStart;
    i < sourceEnd && targetStart < target.length;
    i++, targetStart++
  ) {
    target[targetStart] = source[i];
  }

  return target;
}

export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = arrays.reduce((acc, value) => acc + value.length, 0);

  let result = new Uint8Array(totalLength);

  let offset = 0;
  for (let array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}
