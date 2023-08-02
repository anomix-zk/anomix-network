import { AssetId, NoteType } from '@anomix/circuits';
import { genNewKeyPairBySignature } from '@anomix/utils';
import { ConsolaInstance } from 'consola';
import { Encoding, Poseidon, PrivateKey, PublicKey, Signature } from 'snarkyjs';
import { Database } from './database/database';
import { KeyStore } from './key_store/key_store';
import { Note } from './note/note';
import { AnomixNode } from './rollup_node/anomix_node';
import { Syncer } from './syncer/syncer';
import { UserState } from './user_state/user_state';
import { retryUntil } from './utils/retry';

export class AnomixSdk {
  private keyStore: KeyStore;
  private db: Database;
  private syncer: Syncer;
  private log: ConsolaInstance;
  private node: AnomixNode;

  public async start() {
    await this.syncer.start(1, 1, 5000);
    const host = this.node.getHost();
    this.log.info(`Started, using node at ${host}`);
  }

  public async stop() {
    await this.syncer.stop();
    this.log.info('Stopped');
  }

  public async isSynced() {
    return await this.syncer.isSynced();
  }

  public async awaitSynced(timeout?: number) {
    this.checkState(true);

    await retryUntil(() => this.isSynced(), 'data synced', timeout);
  }

  private checkState(assertRunning: boolean) {
    const isRunning = this.syncer.isRunning();
    if (isRunning !== assertRunning) {
      throw new Error(
        `sdk syncer state:  isRunning:${isRunning} !==  assertRunning: ${assertRunning}`
      );
    }
  }

  public async isAccountSynced(accountPk: string) {
    return await this.syncer.isAccountSynced(accountPk);
  }

  public async awaitAccountSynced(accountPk: string, timeout?: number) {
    this.checkState(true);

    await retryUntil(
      () => this.isAccountSynced(accountPk),
      `account synced ${accountPk}`,
      timeout
    );
  }

  public getAccountKeySigningData(): string {
    return 'Sign this message to generate your Anomix Account Key. This key lets the application decrypt your balance on Anomix.\n\nIMPORTANT: Only sign this message if you trust the application.';
  }

  public getSigningKeySigningData() {
    return 'Sign this message to generate your Anomix Signing Key. This key lets the application spend your funds on Anomix.\n\nIMPORTANT: Only sign this message if you trust the application.';
  }

  public generateKeyPair(sign: Signature): {
    privateKey: PrivateKey;
    publicKey: PublicKey;
  } {
    return genNewKeyPairBySignature(sign);
  }

  public addSecretKey(privateKey: PrivateKey, pwd: string): Promise<PublicKey> {
    return this.keyStore.addAccount(privateKey, pwd);
  }

  public getSecretKey(
    publicKey: PublicKey,
    pwd: string
  ): Promise<PrivateKey | undefined> {
    return this.keyStore.getAccountPrivateKey(publicKey, pwd);
  }

  public async isAccountRegistered(accountPk: string): Promise<boolean> {
    const aliasHash = await this.node.getAliasHashByAccountPublicKey(accountPk);
    if (aliasHash) {
      return true;
    }

    return false;
  }

  public async isAliasRegistered(aliasHash: string): Promise<boolean> {
    const accountPks = await this.node.getAccountPublicKeysByAliasHash(
      aliasHash
    );
    if (accountPks.length > 0) {
      return true;
    }

    return false;
  }

  private computeAliasHash(alias: string): string {
    return Poseidon.hash(Encoding.Bijective.Fp.fromString(alias)).toString();
  }

  public async getAccountPublicKeyByAlias(
    alias: string
  ): Promise<PublicKey | undefined> {
    const aliasHash = this.computeAliasHash(alias);
    const accountPks = await this.node.getAccountPublicKeysByAliasHash(
      aliasHash
    );
    if (accountPks.length > 0) {
      return PublicKey.fromBase58(accountPks[0]);
    }

    return;
  }

  public async getAccountIndexByAlias(
    alias: string
  ): Promise<number | undefined> {
    const aliasHash = this.computeAliasHash(alias);
    const aliases = await this.db.getAliasesByAliasHash(aliasHash);
    if (aliases.length > 0) {
      const newAliases = aliases.sort((a, b) => b.index - a.index);
      return newAliases[0].index;
    }

    return;
  }

  public async getTxFees() {
    return await this.node.getTxFee();
  }

  public async localAccountExists(accountPk: string) {
    const userState = await this.db.getUserState(accountPk);
    if (userState) {
      return true;
    }

    return false;
  }

  public async getAccounts() {
    const userStates = await this.db.getUserStates();
    return userStates;
  }

  public async addAccount(accountPrivateKey: PrivateKey, pwd: string) {
    const accountPk = accountPrivateKey.toPublicKey();
    const accountPk58 = accountPk.toBase58();
    await this.db.upsertUserState(new UserState(accountPk58, 0));
    await this.keyStore.addAccount(accountPrivateKey, pwd);

    this.syncer.addAccount(accountPrivateKey);
    this.log.info(`added account: ${accountPk58}`);

    return accountPk;
  }

  public async getAccountSyncedToBlock(accountPk: string) {
    const userState = await this.db.getUserState(accountPk);
    return userState?.syncedToBlock;
  }

  public async getSigningPublicKeys(accountPk: string) {
    const keys = await this.db.getSigningKeys(accountPk);
    return keys.map((k) => PublicKey.fromBase58(k.signingPk));
  }

  public async getBalance(accountPk: string, assetId: string) {
    await this.awaitAccountSynced(accountPk, 15 * 60 * 1000);

    const unspentNotes = await this.db.getNotes(
      accountPk,
      NoteType.NORMAL.toString()
    );
    let balance = 0n;
    for (let i = 0; i < unspentNotes.length; i++) {
      const note = unspentNotes[i];
      if (note.assetId === assetId) {
        balance = balance + BigInt(unspentNotes[i].value);
      }
    }

    return balance;
  }

  public async getWaitForWithdrawBalance(accountPk: string, assetId: string) {
    await this.awaitAccountSynced(accountPk, 15 * 60 * 1000);
    const unspentNotes = await this.db.getNotes(
      accountPk,
      NoteType.WITHDRAWAL.toString()
    );
    let balance = 0n;
    for (let i = 0; i < unspentNotes.length; i++) {
      const note = unspentNotes[i];
      if (note.assetId === assetId) {
        balance = balance + BigInt(unspentNotes[i].value);
      }
    }

    return balance;
  }

  public async getUserTxs(accountPk: string) {
    return await this.db.getUserTxs(accountPk);
  }
}
