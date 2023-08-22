import { Note } from '../note/note';
import { UserPaymentTx } from '../user_tx/user_payment_tx';
import { UserAccountTx } from '../user_tx/user_account_tx';
import { UserTx } from '../user_tx/user_tx';
import { UserState } from '../user_state/user_state';

export class SigningKey {
  constructor(public accountPk: string, public signingPk: string) {}
}

export class KeyPair {
  constructor(public publicKey: string, public privateKey: string) {}
}

export class Alias {
  constructor(
    public aliasHash: string,
    public accountPk: string,
    public index: number,
    public alias?: string,
    public noteCommitment?: string,
    public signingPk?: string
  ) {}
}

export interface Database {
  close(): Promise<void>;
  clear(): Promise<void>;

  upsertSecretKey(publicKey: string, privateKey: string): Promise<void>;
  getSecretKey(publicKey: string): Promise<string | undefined>;
  getSecretKeys(): Promise<KeyPair[]>;
  deleteSecretKey(publicKey: string): Promise<void>;

  upsertKey(name: string, value: string): Promise<void>;
  getKey(name: string): Promise<string | undefined>;
  deleteKey(name: string): Promise<void>;

  upsertNote(note: Note): Promise<void>;
  upsertNotes(notes: Note[]): Promise<void>;
  getNote(commitment: string): Promise<Note | undefined>;
  getNoteByNullifier(nullifier: string): Promise<Note | undefined>;
  nullifyNote(nullifier: string): Promise<void>;
  getNotes(accountPk: string, noteType: string): Promise<Note[]>;
  getPendingNotes(accoutPk: string): Promise<Note[]>;
  removeNote(nullifier: string): Promise<void>;

  upsertUserPaymentTx(tx: UserPaymentTx): Promise<void>;
  getUserPaymentTx(
    accountPk: string,
    txHash: string
  ): Promise<UserPaymentTx | undefined>;
  getUserPaymentTxs(accountPk: string): Promise<UserPaymentTx[]>;

  upsertUserAccountTx(tx: UserAccountTx): Promise<void>;
  getUserAccountTx(txHash: string): Promise<UserAccountTx | undefined>;
  getUserAccountTxs(accountPk: string): Promise<UserAccountTx[]>;

  getUserTxs(accountPk: string): Promise<UserTx[]>;
  isUserTxSettled(txHash: string): Promise<boolean>;
  getPendingUserTxs(accountPk: string): Promise<UserTx[]>;
  removeUserTx(accountPk: string, txHash: string): Promise<void>;

  upsertSigningKey(signingKey: SigningKey): Promise<void>;
  upsertSigningKeys(signingKeys: SigningKey[]): Promise<void>;
  getSigningKeys(accountPk: string): Promise<SigningKey[]>;
  removeSigningKeys(accountPk: string): Promise<void>;

  upsertAlias(alias: Alias): Promise<void>;
  upsertAliases(alias: Alias[]): Promise<void>;
  getAliases(accountPk: string): Promise<Alias[]>;
  getAliasesByAliasHash(aliasHash: string): Promise<Alias[]>;

  getUserState(accountPk: string): Promise<UserState | undefined>;
  getUserStates(): Promise<UserState[]>;
  upsertUserState(userState: UserState): Promise<void>;
  removeUserState(accountPk: string): Promise<void>;
  resetUserStates(): Promise<void>;
}
