import { PrivateKey, PublicKey } from 'snarkyjs';

export interface KeyStore {
  addAccount(privKey: PrivateKey, pwd: string): Promise<PublicKey>;
  getAccounts(): Promise<PublicKey[]>;
  getAccountPrivateKey(
    pubKey: PublicKey,
    pwd: string
  ): Promise<PrivateKey | undefined>;
}
