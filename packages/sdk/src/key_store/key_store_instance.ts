import { decrypt, encrypt } from '@anomix/utils';
import { Poseidon, PrivateKey, PublicKey, Encoding } from 'snarkyjs';
import { Database } from '../database/database';
import { KeyStore } from './key_store';

const KEY_SALT = Poseidon.hash(
  Encoding.Bijective.Fp.fromString('Anomix Secret Key Storage')
).toString();

export class KeyStoreInstance implements KeyStore {
  constructor(public db: Database) {}

  public async addAccount(
    privKey: PrivateKey,
    pwd: string
  ): Promise<PublicKey> {
    const pubKey = privKey.toPublicKey();
    const cipherText = await encrypt(privKey.toBase58(), KEY_SALT, pwd);
    await this.db.addKey(pubKey.toBase58(), cipherText);
    return pubKey;
  }

  public async getAccounts(): Promise<PublicKey[]> {
    const keys = await this.db.getSecretKeys();
    return keys.map((k) => PublicKey.fromBase58(k.publicKey));
  }

  public async getAccountPrivateKey(
    pubKey: PublicKey,
    pwd: string
  ): Promise<PrivateKey | undefined> {
    const priKeyCipherText = await this.db.getSecretKey(pubKey.toBase58());
    if (priKeyCipherText) {
      const priKeyBase58 = await decrypt(priKeyCipherText, KEY_SALT, pwd);
      return PrivateKey.fromBase58(priKeyBase58);
    }

    return undefined;
  }
}
