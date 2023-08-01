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
    public signingPk?: string,
    public noteCommitment?: string
  ) {}
}

export interface Database {
  close(): Promise<void>;
  clear(): Promise<void>;

  addSecretKey(publicKey: string, privateKey: string): Promise<void>;
  getSecretKey(publicKey: string): Promise<string | undefined>;
  getSecretKeys(): Promise<KeyPair[]>;
  deleteSecretKey(publicKey: string): Promise<void>;

  addKey(name: string, value: string): Promise<void>;
  getKey(name: string): Promise<string | undefined>;
  deleteKey(name: string): Promise<void>;

  addNote(note: Note): Promise<void>;
  addNotes(notes: Note[]): Promise<void>;
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

  addSigningKey(signingKey: SigningKey): Promise<void>;
  addSigningKeys(signingKeys: SigningKey[]): Promise<void>;
  getSigningKeys(accountPk: string): Promise<SigningKey[]>;
  removeSigningKeys(accountPk: string): Promise<void>;

  addAlias(alias: Alias): Promise<void>;
  addAliases(alias: Alias[]): Promise<void>;
  getAlias(accountPk: string): Promise<Alias | undefined>;
  getAliasByAliasHash(aliasHash: string): Promise<Alias | undefined>;

  getUserState(accountPk: string): Promise<UserState | undefined>;
  getUserStates(): Promise<UserState[]>;
  upsertUserState(userState: UserState): Promise<void>;
  removeUserState(accountPk: string): Promise<void>;
  resetUserStates(): Promise<void>;
}
