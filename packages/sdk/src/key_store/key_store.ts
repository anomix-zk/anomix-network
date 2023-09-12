import { PrivateKey, PublicKey } from 'o1js';

export interface KeyStore {
  addAccount(
    privKey: PrivateKey,
    pwd: string,
    isCached?: boolean
  ): Promise<PublicKey>;
  getAccounts(): Promise<PublicKey[]>;
  getAccountPrivateKey(
    pubKey: PublicKey,
    pwd?: string
  ): Promise<PrivateKey | undefined>;

  unlock(cachePubKeys: string[], pwd: string): Promise<void>;
  lock(): void;
}
