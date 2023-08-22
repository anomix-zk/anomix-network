import { decrypt, encrypt } from '@anomix/utils';
import { Poseidon, PrivateKey, PublicKey, Encoding } from 'snarkyjs';
import { Database } from '../database/database';
import { KeyStore } from './key_store';

const KEY_SALT = Poseidon.hash(
  Encoding.Bijective.Fp.fromString('Anomix Secret Key Storage')
).toString();

export class PasswordKeyStore implements KeyStore {
  private cache: { [pubKey: string]: PrivateKey | undefined } = {};

  constructor(public db: Database) {}

  public async unlock(cachePubKeys: string[], pwd: string): Promise<void> {
    for (let i = 0; i < cachePubKeys.length; i++) {
      const pubKey = cachePubKeys[i];
      const priKeyCipherText = await this.db.getSecretKey(pubKey);
      if (priKeyCipherText) {
        const priKeyBase58 = await decrypt(priKeyCipherText, KEY_SALT, pwd);
        this.cache[pubKey] = PrivateKey.fromBase58(priKeyBase58);
      } else {
        throw new Error(`Cannot find private key for public key: ${pubKey}`);
      }
    }
  }

  public lock(): void {
    this.cache = {};
  }

  public async addAccount(
    privKey: PrivateKey,
    pwd: string,
    isCached?: boolean
  ): Promise<PublicKey> {
    const pubKey = privKey.toPublicKey();
    const cipherText = await encrypt(privKey.toBase58(), KEY_SALT, pwd);
    await this.db.upsertKey(pubKey.toBase58(), cipherText);

    if (isCached) {
      this.cache[pubKey.toBase58()] = privKey;
    }

    return pubKey;
  }

  public async getAccounts(): Promise<PublicKey[]> {
    const keys = await this.db.getSecretKeys();
    return keys.map((k) => PublicKey.fromBase58(k.publicKey));
  }

  public async getAccountPrivateKey(
    pubKey: PublicKey,
    pwd?: string
  ): Promise<PrivateKey | undefined> {
    if (!pwd) {
      return this.cache[pubKey.toBase58()];
    } else {
      const priKeyCipherText = await this.db.getSecretKey(pubKey.toBase58());
      if (priKeyCipherText) {
        const priKeyBase58 = await decrypt(priKeyCipherText, KEY_SALT, pwd);
        return PrivateKey.fromBase58(priKeyBase58);
      }

      return undefined;
    }
  }
}
