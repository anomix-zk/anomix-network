import { decrypt, encrypt } from '@anomix/utils';
import { Encoding, Poseidon, PrivateKey } from 'snarkyjs';

export async function decryptAlias(
  aliasInfo: string,
  aliasHash: string,
  accountPrivateKey: PrivateKey
) {
  const secret = Poseidon.hash(accountPrivateKey.toFields()).toString();
  return await decrypt(aliasInfo, aliasHash, secret, 10000);
}

export async function encryptAlias(
  alias: string,
  accountPrivateKey: PrivateKey
) {
  const secret = Poseidon.hash(accountPrivateKey.toFields()).toString();
  const keySalt = Poseidon.hash(
    Encoding.Bijective.Fp.fromString(alias)
  ).toString();
  return await encrypt(alias, keySalt, secret, 10000);
}
