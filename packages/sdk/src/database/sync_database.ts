// import { Note } from '../note/note';
// import { UserState } from '../user_state/user_state';
// import { UserAccountTx } from '../user_tx/user_account_tx';
// import { UserPaymentTx } from '../user_tx/user_payment_tx';
// import { UserTx } from '../user_tx/user_tx';
// import { Alias, Database, KeyPair, SigningKey } from './database';
// import { Mutex } from 'async-mutex';

// export class SyncDatabase implements Database {
//   private writeMutex = new Mutex();

//   constructor(private db: Database) {}

//   private async sync<T>(fn: () => Promise<T>) {
//     const release = await this.writeMutex.acquire();
//     try {
//       return await fn();
//     } finally {
//       release();
//     }
//   }

//   close(): Promise<void> {
//     return this.sync(() => this.db.close());
//   }
//   clear(): Promise<void> {
//     return this.sync(() => this.db.clear());
//   }
//   addSecretKey(publicKey: string, privateKey: string): Promise<void> {
//     return this.sync(() => this.db.addSecretKey(publicKey, privateKey));
//   }
//   getSecretKey(publicKey: string): Promise<string | undefined> {
//     return this.sync(() => this.db.getSecretKey(publicKey));
//   }
//   getSecretKeys(): Promise<KeyPair[]> {
//     return this.sync(() => this.db.getSecretKeys());
//   }
//   deleteSecretKey(publicKey: string): Promise<void> {
//     return this.sync(() => this.db.deleteSecretKey(publicKey));
//   }
//   addKey(name: string, value: string): Promise<void> {
//     return this.sync(() => this.db.addKey(name, value));
//   }
//   getKey(name: string): Promise<string | undefined> {
//     return this.sync(() => this.db.getKey(name));
//   }
//   deleteKey(name: string): Promise<void> {
//     return this.sync(() => this.db.deleteKey(name));
//   }
//   addNote(note: Note): Promise<void> {
//     return this.sync(() => this.db.addNote(note));
//   }
//   addNotes(notes: Note[]): Promise<void> {
//     return this.sync(() => this.db.addNotes(notes));
//   }
//   getNote(commitment: string): Promise<Note | undefined> {
//     return this.sync(() => this.db.getNote(commitment));
//   }
//   getNoteByNullifier(nullifier: string): Promise<Note | undefined> {
//     return this.sync(() => this.db.getNoteByNullifier(nullifier));
//   }
//   nullifyNote(nullifier: string): Promise<void> {
//     return this.sync(() => this.db.nullifyNote(nullifier));
//   }
//   getNotes(accountPk: string, noteType: string): Promise<Note[]> {
//     return this.sync(() => this.db.getNotes(accountPk, noteType));
//   }
//   getPendingNotes(accoutPk: string): Promise<Note[]> {
//     return this.sync(() => this.db.getPendingNotes(accoutPk));
//   }
//   removeNote(nullifier: string): Promise<void> {
//     return this.sync(() => this.db.removeNote(nullifier));
//   }
//   upsertUserPaymentTx(tx: UserPaymentTx): Promise<void> {
//     return this.sync(() => this.db.upsertUserPaymentTx(tx));
//   }
//   getUserPaymentTx(
//     accountPk: string,
//     txHash: string
//   ): Promise<UserPaymentTx | undefined> {
//     return this.sync(() => this.db.getUserPaymentTx(accountPk, txHash));
//   }
//   getUserPaymentTxs(accountPk: string): Promise<UserPaymentTx[]> {
//     return this.sync(() => this.db.getUserPaymentTxs(accountPk));
//   }
//   upsertUserAccountTx(tx: UserAccountTx): Promise<void> {
//     return this.sync(() => this.db.upsertUserAccountTx(tx));
//   }
//   getUserAccountTx(txHash: string): Promise<UserAccountTx | undefined> {
//     return this.sync(() => this.db.getUserAccountTx(txHash));
//   }
//   getUserAccountTxs(accountPk: string): Promise<UserAccountTx[]> {
//     return this.sync(() => this.db.getUserAccountTxs(accountPk));
//   }
//   getUserTxs(accountPk: string): Promise<UserTx[]> {
//     return this.sync(() => this.db.getUserTxs(accountPk));
//   }
//   isUserTxSettled(txHash: string): Promise<boolean> {
//     return this.sync(() => this.db.isUserTxSettled(txHash));
//   }
//   getPendingUserTxs(accountPk: string): Promise<UserTx[]> {
//     return this.sync(() => this.db.getPendingUserTxs(accountPk));
//   }
//   removeUserTx(accountPk: string, txHash: string): Promise<void> {
//     return this.sync(() => this.db.removeUserTx(accountPk, txHash));
//   }
//   addSigningKey(signingKey: SigningKey): Promise<void> {
//     return this.sync(() => this.db.addSigningKey(signingKey));
//   }
//   addSigningKeys(signingKeys: SigningKey[]): Promise<void> {
//     return this.sync(() => this.db.addSigningKeys(signingKeys));
//   }
//   getSigningKeys(accountPk: string): Promise<SigningKey[]> {
//     return this.sync(() => this.db.getSigningKeys(accountPk));
//   }
//   removeSigningKeys(accountPk: string): Promise<void> {
//     return this.sync(() => this.db.removeSigningKeys(accountPk));
//   }
//   addAlias(alias: Alias): Promise<void> {
//     return this.sync(() => this.db.addAlias(alias));
//   }
//   addAliases(alias: Alias[]): Promise<void> {
//     return this.sync(() => this.db.addAliases(alias));
//   }
//   getAlias(accountPk: string): Promise<Alias | undefined> {
//     return this.sync(() => this.db.getAlias(accountPk));
//   }
//   getAliasByAliasHash(aliasHash: string): Promise<Alias | undefined> {
//     return this.sync(() => this.db.getAliasByAliasHash(aliasHash));
//   }
//   getUserState(accountPk: string): Promise<UserState | undefined> {
//     return this.sync(() => this.db.getUserState(accountPk));
//   }
//   getUserStates(): Promise<UserState[]> {
//     return this.sync(() => this.db.getUserStates());
//   }
//   upsertUserState(userState: UserState): Promise<void> {
//     return this.sync(() => this.db.upsertUserState(userState));
//   }
//   removeUserState(accountPk: string): Promise<void> {
//     return this.sync(() => this.db.removeUserState(accountPk));
//   }
//   resetUserStates(): Promise<void> {
//     return this.sync(() => this.db.resetUserStates());
//   }
// }
