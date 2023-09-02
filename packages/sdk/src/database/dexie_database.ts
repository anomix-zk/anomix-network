import Dexie from 'dexie';
import { Note } from '../note/note';
import { UserState } from '../user_state/user_state';
import { ActionType } from '@anomix/circuits';
import { UserAccountTx } from '../user_tx/user_account_tx';
import { UserPaymentTx } from '../user_tx/user_payment_tx';
import { UserTx } from '../user_tx/user_tx';
import { Alias, Database, KeyPair, SigningKey } from './database';
import { sortTxs } from './sort_txs';

class DexieNote {
  constructor(
    public accountRequired: string,
    public assetId: string,
    public creatorPk: string,
    public inputNullifier: string,
    public noteType: string,
    public ownerPk: string,
    public secret: string,
    public value: string,
    public commitment: string,
    public nullifier: string,
    public index: number,
    public nullified: boolean,
    public pending: boolean
  ) {}
}

function toDexieNote(note: Note): DexieNote {
  return new DexieNote(
    note.valueNoteJSON.accountRequired,
    note.valueNoteJSON.assetId,
    note.valueNoteJSON.creatorPk,
    note.valueNoteJSON.inputNullifier,
    note.valueNoteJSON.noteType,
    note.valueNoteJSON.ownerPk,
    note.valueNoteJSON.secret,
    note.valueNoteJSON.value,
    note.commitment,
    note.nullifier,
    note.index === undefined ? -1 : note.index,
    note.nullified,
    note.pending
  );
}

function fromDexieNote(note: DexieNote): Note {
  return new Note(
    {
      accountRequired: note.accountRequired,
      assetId: note.assetId,
      creatorPk: note.creatorPk,
      inputNullifier: note.inputNullifier,
      noteType: note.noteType,
      ownerPk: note.ownerPk,
      secret: note.secret,
      value: note.value,
    },
    note.commitment,
    note.nullifier,
    note.nullified,
    note.index === -1 ? undefined : note.index
  );
}

class DexieKey {
  constructor(public name: string, public value: string) {}
}

class DexieUserTx {
  constructor(
    public txHash: string,
    public accountPk: string,
    public actionType: string,
    public createdTs: number,
    public finalizedTs: number
  ) {}
}

class DexiePaymentTx implements DexieUserTx {
  constructor(
    public txHash: string,
    public accountPk: string,
    public actionType: string,
    public publicValue: string,
    public publicAssetId: string,
    public txFee: string,
    public txFeeAssetId: string,
    public depositRoot: string,
    public depositIndex: number,
    public privateValue: string,
    public privateValueAssetId: string,
    public sender: string,
    public receiver: string,
    public isSender: boolean,
    public createdTs: number,
    public finalizedTs: number,
    public publicOwner?: string,
    public withdrawNoteCommitment?: string
  ) {}
}

function fromDexiePaymentTx(tx: DexiePaymentTx): UserPaymentTx {
  return new UserPaymentTx(
    tx.txHash,
    tx.accountPk,
    tx.actionType,
    tx.publicValue,
    tx.publicAssetId,
    tx.publicOwner,
    tx.txFee,
    tx.txFeeAssetId,
    tx.depositRoot,
    tx.depositIndex,
    tx.privateValue,
    tx.privateValueAssetId,
    tx.withdrawNoteCommitment,
    tx.sender,
    tx.receiver,
    tx.isSender,
    tx.createdTs,
    tx.finalizedTs
  );
}

function toDexiePaymentTx(tx: UserPaymentTx): DexiePaymentTx {
  return new DexiePaymentTx(
    tx.txHash,
    tx.accountPk,
    tx.actionType,
    tx.publicValue,
    tx.publicAssetId,
    tx.txFee,
    tx.txFeeAssetId,
    tx.depositRoot,
    tx.depositIndex,
    tx.privateValue,
    tx.privateValueAssetId,
    tx.sender,
    tx.receiver,
    tx.isSender,
    tx.createdTs,
    tx.finalizedTs,
    tx.publicOwner,
    tx.withdrawNoteCommitment
  );
}

class DexieAccountTx implements DexieUserTx {
  constructor(
    public txHash: string,
    public accountPk: string,
    public actionType: string,
    public aliasHash: string,
    public txFee: string,
    public txFeeAssetId: string,
    public migrated: boolean,
    public createdTs: number,
    public finalizedTs: number,
    public alias?: string,
    public newSigningPk1?: string,
    public newSigningPk2?: string
  ) {}
}

function fromDexieAccountTx(tx: DexieAccountTx): UserAccountTx {
  return new UserAccountTx(
    tx.txHash,
    tx.accountPk,
    tx.aliasHash,
    tx.alias,
    tx.newSigningPk1,
    tx.newSigningPk2,
    tx.txFee,
    tx.txFeeAssetId,
    tx.migrated,
    tx.createdTs,
    tx.finalizedTs
  );
}

function toDexieAccountTx(tx: UserAccountTx): DexieAccountTx {
  return new DexieAccountTx(
    tx.txHash,
    tx.accountPk,
    ActionType.ACCOUNT.toString(),
    tx.aliasHash,
    tx.txFee,
    tx.txFeeAssetId,
    tx.migrated,
    tx.createdTs,
    tx.finalizedTs,
    tx.alias,
    tx.newSigningPk1,
    tx.newSigningPk2
  );
}

function fromDexieUserTx(tx: DexieUserTx): UserTx {
  if (tx.actionType === ActionType.ACCOUNT.toString()) {
    return fromDexieAccountTx(tx as DexieAccountTx);
  } else {
    return fromDexiePaymentTx(tx as DexiePaymentTx);
  }
}

export class DexieDatabase implements Database {
  private dexie!: Dexie;
  private alias!: Dexie.Table<Alias, string>;
  private note!: Dexie.Table<DexieNote, string>;
  private signingKey!: Dexie.Table<SigningKey, string>;
  private userState!: Dexie.Table<UserState, string>;
  private userTx!: Dexie.Table<DexieUserTx, string>;
  private key!: Dexie.Table<DexieKey, string>;
  private secretKey!: Dexie.Table<KeyPair, string>;
  // private mutex!: Dexie.Table<DexieMutex, string>;

  constructor(private dbName = 'anomix', private version = 1) {}

  async open() {
    this.createTables();
  }

  async close(): Promise<void> {
    this.dexie.close();
    return Promise.resolve();
  }
  async clear(): Promise<void> {
    await this.dexie.delete();
    this.createTables();
  }

  async upsertKey(name: string, value: string): Promise<void> {
    await this.key.put({ name, value });
  }
  async getKey(name: string): Promise<string | undefined> {
    const key = await this.key.get(name);
    if (!key) {
      return undefined;
    } else {
      return key.value;
    }
  }
  async deleteKey(name: string): Promise<void> {
    const key = await this.key.get(name);
    if (!key) {
      return;
    }

    await this.key.where({ name }).delete();
  }

  async upsertSecretKey(publicKey: string, privateKey: string): Promise<void> {
    await this.secretKey.put({ publicKey, privateKey });
  }
  async getSecretKey(publicKey: string): Promise<string | undefined> {
    const key = await this.secretKey.get(publicKey);
    if (!key) {
      return undefined;
    } else {
      return key.privateKey;
    }
  }
  async getSecretKeys(): Promise<KeyPair[]> {
    return await this.secretKey.toArray();
  }
  async deleteSecretKey(publicKey: string): Promise<void> {
    const key = await this.secretKey.get(publicKey);
    if (!key) {
      return;
    }

    await this.key.where({ publicKey }).delete();
  }

  async upsertNote(note: Note): Promise<void> {
    await this.note.put(toDexieNote(note));
  }
  async upsertNotes(notes: Note[]): Promise<void> {
    await this.note.bulkPut(notes.map(toDexieNote));
  }
  async getNote(commitment: string): Promise<Note | undefined> {
    const note = await this.note.get({ commitment });
    return note ? fromDexieNote(note) : undefined;
  }
  async getNoteByNullifier(nullifier: string): Promise<Note | undefined> {
    const note = await this.note.get({ nullifier });
    return note ? fromDexieNote(note) : undefined;
  }
  async nullifyNote(nullifier: string): Promise<void> {
    await this.note.where({ nullifier }).modify({ nullified: true });
  }
  async getNotes(accountPk: string, noteType: string): Promise<Note[]> {
    return (
      await this.note
        .where({ ownerPk: accountPk, noteType, nullified: false })
        .toArray()
    ).map(fromDexieNote);
  }
  async getPendingNotes(accoutPk: string): Promise<Note[]> {
    return (
      await this.note.where({ ownerPk: accoutPk, pending: true }).toArray()
    ).map(fromDexieNote);
  }
  async removeNote(nullifier: string): Promise<void> {
    await this.note.where({ nullifier }).delete();
  }
  async upsertUserPaymentTx(tx: UserPaymentTx): Promise<void> {
    await this.userTx.put(toDexiePaymentTx(tx));
  }
  async getUserPaymentTx(
    accountPk: string,
    txHash: string
  ): Promise<UserPaymentTx | undefined> {
    const tx = await this.userTx.get({
      txHash,
      accountPk,
    });
    return tx &&
      [
        ActionType.DEPOSIT.toString(),
        ActionType.WITHDRAW.toString(),
        ActionType.SEND.toString(),
      ].includes(tx.actionType)
      ? fromDexiePaymentTx(tx as DexiePaymentTx)
      : undefined;
  }
  async getUserPaymentTxs(accountPk: string): Promise<UserPaymentTx[]> {
    const txs = (
      await this.userTx.where({ accountPk }).reverse().sortBy('createdTs')
    ).filter((p) =>
      [
        ActionType.DEPOSIT.toString(),
        ActionType.WITHDRAW.toString(),
        ActionType.SEND.toString(),
      ].includes(p.actionType)
    ) as DexiePaymentTx[];

    return sortTxs(txs).map(fromDexiePaymentTx);
  }
  async upsertUserAccountTx(tx: UserAccountTx): Promise<void> {
    await this.userTx.put(toDexieAccountTx(tx));
  }
  async getUserAccountTx(txHash: string): Promise<UserAccountTx | undefined> {
    const tx = await this.userTx.get({
      txHash,
      actionType: ActionType.ACCOUNT.toString(),
    });
    return tx ? fromDexieAccountTx(tx as DexieAccountTx) : undefined;
  }
  async getUserAccountTxs(accountPk: string): Promise<UserAccountTx[]> {
    const txs = (await this.userTx
      .where({ accountPk, actionType: ActionType.ACCOUNT.toString() })
      .reverse()
      .sortBy('createdTs')) as DexieAccountTx[];
    return sortTxs(txs).map(fromDexieAccountTx);
  }
  async getUserTxs(accountPk: string): Promise<UserTx[]> {
    const txs = await this.userTx
      .where({ accountPk })
      .filter((x) => x.createdTs > 0)
      .reverse()
      .sortBy('createdTs');
    return sortTxs(txs).map(fromDexieUserTx);
  }
  async isUserTxSettled(txHash: string): Promise<boolean> {
    const txs = await this.userTx.where({ txHash }).toArray();
    return txs.length > 0 && txs.every((tx) => tx.createdTs > 0);
  }
  async getPendingUserTxs(accountPk: string): Promise<UserTx[]> {
    const unsettledTxs = await this.userTx
      .where({ accountPk, createdTs: 0 })
      .toArray();
    return unsettledTxs.map(fromDexieUserTx);
  }
  async removeUserTx(accountPk: string, txHash: string): Promise<void> {
    await this.userTx.where({ txHash, accountPk }).delete();
  }
  async upsertSigningKey(signingKey: SigningKey): Promise<void> {
    await this.signingKey.put(signingKey);
  }
  async upsertSigningKeys(signingKeys: SigningKey[]): Promise<void> {
    await this.signingKey.bulkPut(signingKeys);
  }

  async getSigningKeys(accountPk: string): Promise<SigningKey[]> {
    return await this.signingKey.where({ accountPk }).toArray();
  }

  async removeSigningKeys(accountPk: string): Promise<void> {
    await this.signingKey.where({ accountPk }).delete();
  }
  async upsertAlias(alias: Alias): Promise<void> {
    await this.alias.put(alias);
  }
  async upsertAliases(alias: Alias[]): Promise<void> {
    await this.alias.bulkPut(alias);
  }
  async getAliases(accountPk: string): Promise<Alias[]> {
    return await this.alias.where({ accountPk }).toArray();
  }
  async getAliasesByAliasHash(aliasHash: string): Promise<Alias[]> {
    const aliases = await this.alias.where({ aliasHash }).toArray();
    return aliases.sort((a, b) => (a.index < b.index ? 1 : -1));
  }
  async getUserState(accountPk: string): Promise<UserState | undefined> {
    return await this.userState.get(accountPk);
  }
  async getUserStates(): Promise<UserState[]> {
    return await this.userState.toArray();
  }
  async upsertUserState(userState: UserState): Promise<void> {
    await this.userState.put(userState);
  }
  async removeUserState(accountPk: string): Promise<void> {
    await this.userState.where({ accountPk }).delete();
    await this.userTx.where({ accountPk }).delete();
    await this.signingKey.where({ accountPk }).delete();
    await this.note.where({ accountPk }).delete();
  }
  async resetUserStates(): Promise<void> {
    await this.userState.toCollection().modify({ syncedToBlock: 0 });
    await this.note.clear();
    await this.userTx.clear();
    await this.signingKey.clear();
  }

  private createTables() {
    this.dexie = new Dexie(this.dbName);
    this.dexie.version(this.version).stores({
      alias: '&[aliasHash+accountPk+index], aliasHash, accountPk',
      key: '&name',
      secretKey: '&publicKey',
      note: '&commitment, nullifier, [ownerPk+noteType+nullified], [ownerPk+pending]',
      signingKey: '&[accountPk+signingPk], accountPk',
      userState: '&accountPk',
      userTx:
        '&[txHash+accountPk], txHash, [txHash+actionType], [accountPk+actionType], accountPk, [accountPk+createdTs]',
    });

    this.alias = this.dexie.table('alias');
    this.key = this.dexie.table('key');
    this.secretKey = this.dexie.table('secretKey');
    this.note = this.dexie.table('note');
    this.signingKey = this.dexie.table('signingKey');
    this.userState = this.dexie.table('userState');
    this.userTx = this.dexie.table('userTx');
  }
}
