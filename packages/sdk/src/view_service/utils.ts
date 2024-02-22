import { stringToUtf8Array } from '@anomix/utils';
import { PrivateKey, PublicKey } from 'o1js';

export function calculateShareSecret(
  priKey: PrivateKey,
  otherPubKey: PublicKey
): string {
  const fields = otherPubKey.toGroup().scale(priKey.s).toFields();
  const f1 = fields[0].toBigInt();
  const f2 = fields[1].toBigInt();

  return (f1 & f2).toString();
}

/*
  Get some key material to use as input to the deriveKey method.
  The key material is a password supplied by the user.
*/
export async function getKeyMaterial(password: string): Promise<CryptoKey> {
  return await subtle.importKey(
    'raw',
    stringToUtf8Array(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

export const uint8ArrayToBase64 = (buf: Uint8Array) => {
  let binary = '';
  const length = buf.length;

  for (let i = 0; i < length; i++) {
    binary += String.fromCharCode(buf[i]);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  if (typeof Buffer === 'function') {
    const buffer = Buffer.from(binary, 'binary');
    return buffer.toString('base64');
  }

  throw new Error('Base64 conversion not supported in this environment.');
};

export const base64ToUint8Array = (base64String: string) => {
  if (typeof Buffer === 'function') {
    const buffer = Buffer.from(base64String, 'base64');
    return new Uint8Array(buffer);
  }

  if (typeof atob === 'function') {
    const binaryString = atob(base64String);
    const length = binaryString.length;
    const uint8Array = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }

    return uint8Array;
  }
};

export function structToBase64<StructType>(
  type: FlexibleProvablePure<StructType>,
  value: StructType
) {
  const fs = type.toFields(value);
  let bytes: number[] = [];
  fs.forEach((f) => bytes.concat(Field.toBytes(f)));
  const u8Arr = new Uint8Array(bytes);

  return uint8ArrayToBase64(u8Arr);
}

export function base64ToStruct<StructType>(
  b64Str: string,
  type: FlexibleProvablePure<StructType>
) {
  const u8Arr = Array.from(base64ToUint8Array(b64Str)!);
  const fsize = type.sizeInFields();
  let fs: Field[] = [];

  let pos = 0;
  for (let i = 0; i < fsize; i++) {
    let f = Field.readBytes(u8Arr, pos as never)[0];
    fs.push(f);
    pos += 32;
  }

  return type.fromFields(fs) as StructType;
}

/**
 * Convert a string to an array of 8-bit integers
 * @param str String to convert
 * @returns An array of 8-bit integers
 */
export const binaryStringToArray = (str: string) => {
  if (!isString(str)) {
    throw new Error(
      'binaryStringToArray: Data must be in the form of a string'
    );
  }

  const result = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    result[i] = str.charCodeAt(i);
  }
  return result;
};
