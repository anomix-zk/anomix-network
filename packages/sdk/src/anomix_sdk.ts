import {
  AccountOperationType,
  ActionType,
  AnomixEntryContract,
  AssetId,
  calculateNoteNullifier,
  DataMerkleWitness,
  DepositRollupProver,
  DUMMY_FIELD,
  encryptValueNoteToFieldData,
  JoinSplitAccountInput,
  JoinSplitProver,
  JoinSplitSendInput,
  NoteType,
  ValueNote,
  AnomixVaultContract,
  WithdrawAccount,
  WithdrawNoteWitnessData,
  UserLowLeafWitnessData,
  UserNullifierMerkleWitness,
  AccountRequired,
} from '@anomix/circuits';
import { EncryptedNote, L2TxReqDto } from '@anomix/types';
import {
  calculateShareSecret,
  derivePublicKeyBigInt,
  encrypt,
  genNewKeyPairBySignature,
  genNewKeyPairForNote,
  maskReceiverBySender,
} from '@anomix/utils';
import { DetectionKey } from '@anomix/fmd';
import consola, { ConsolaInstance } from 'consola';
import {
  AccountUpdate,
  Bool,
  Encoding,
  fetchAccount,
  Field,
  Mina,
  Poseidon,
  PrivateKey,
  PublicKey,
  Scalar,
  Signature,
  UInt64,
} from 'o1js';
import { Database, PendingNullifier } from './database/database';
import { KeyStore } from './key_store/key_store';
import { PasswordKeyStore } from './key_store/password_key_store';
import { MinaSignerProvider, ProviderSignature } from './mina_provider';
import { Note } from './note/note';
import { AnomixNode } from './rollup_node/anomix_node';
import { NodeProvider } from './rollup_node/node_provider';
import { SdkOptions } from './sdk_options';
import { Syncer } from './syncer/syncer';
import { UserState } from './user_state/user_state';
import { convertProviderSignatureToSignature } from './utils/convert';
import { retryUntil } from './utils/retry';
import { NotePicker } from './note_picker/note_picker';
import { UserPaymentTx } from './user_tx/user_payment_tx';
import { SdkEvent, Tx } from './types/types';
import { UserAccountTx } from './user_tx/user_account_tx';

import type { SyncerWrapper } from './syncer/syncer_worker';
// import { Worker as NodeWorker } from 'worker_threads';
import isNode from 'detect-node';
import { Remote, wrap } from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter';
import { DEFAULT_L1_TX_FEE, SdkEventType } from './constants';
import { decryptAlias, encryptAlias } from './note_decryptor/alias_util';
import { UserTx } from './user_tx/user_tx';
// import { dirname } from 'path';
// import { fileURLToPath } from 'url';

// let _filename;
// let _dirname;
// if (isNode) {
//   _filename = fileURLToPath(import.meta.url);
//   _dirname = dirname(_filename);
// }

export class AnomixSdk {
  private entryContract: AnomixEntryContract;
  private isEntryContractCompiled: boolean = false;

  private vaultContract: AnomixVaultContract;
  private isVaultContractCompiled: boolean = false;

  private keyStore: KeyStore;
  private syncer: Syncer;
  private log: ConsolaInstance;
  private node: AnomixNode;
  private useSyncerWorker: boolean = false;
  private syncerWorker: Worker;
  private remoteSyncer: Remote<SyncerWrapper>;

  private isPrivateCircuitCompiled: boolean = false;
  private broadcastChannel: BroadcastChannel | undefined;

  constructor(
    private db: Database,
    private entryContractAddress: PublicKey,
    private vaultContractAddress: PublicKey,
    private options: SdkOptions
  ) {
    this.log = consola.withTag('anomix:sdk');
    if (options.debug) {
      consola.level = 4;
    }

    this.node = new NodeProvider(
      options.nodeUrl,
      options.nodeRequestTimeoutMS
        ? options.nodeRequestTimeoutMS
        : 3 * 60 * 1000
    );

    this.keyStore = new PasswordKeyStore(db);
    this.syncer = new Syncer(
      this.node,
      db,
      this.keyStore,
      options.broadcastChannelName,
      options.logChannelName
    );
    this.entryContract = new AnomixEntryContract(entryContractAddress);
    this.vaultContract = new AnomixVaultContract(vaultContractAddress);
    if (!isNode && options.broadcastChannelName) {
      this.broadcastChannel = new BroadcastChannel(
        options.broadcastChannelName
      );
    }

    this.log.info('Endpoint-mina: ', options.minaEndpoint);
    let blockchain = Mina.Network(options.minaEndpoint);
    Mina.setActiveInstance(blockchain);
  }

  public getWithdrawAccountTokenId() {
    return this.vaultContract.token.id;
  }

  public async compileVaultContract() {
    this.log.info('Compile VaultContract...');
    if (!this.isVaultContractCompiled) {
      console.time('compile withdrawAccount');
      await WithdrawAccount.compile();
      console.timeEnd('compile withdrawAccount');
      this.log.info(
        'withdrawAccount vk hash: ',
        WithdrawAccount._verificationKey!.hash.toString()
      );

      console.time('compile vaultContract');
      AnomixVaultContract.withdrawAccountVkHash =
        WithdrawAccount._verificationKey!.hash;
      await AnomixVaultContract.compile();
      this.isVaultContractCompiled = true;

      this.broadcastChannel?.postMessage({
        eventType: SdkEventType.VAULT_CONTRACT_COMPILED_DONE,
      } as SdkEvent);
      console.timeEnd('compile vaultContract');
      this.log.info(
        'vaultContract vk hash: ',
        AnomixVaultContract._verificationKey!.hash.toString()
      );

      this.log.info('Compile VaultContract done');
    } else {
      this.log.info('VaultContract already compiled');
    }
  }

  public async compileEntryContract() {
    this.log.info('Compile EntryContract...');

    this.log.info('Compile EntryContract dependencies...');
    await this.compileVaultContract();

    if (!this.isEntryContractCompiled) {
      console.time('compile depositRollupProver');
      let { verificationKey: depositRollupVk } =
        await DepositRollupProver.compile();
      console.timeEnd('compile depositRollupProver');
      this.log.info('depositRollupProver vk: ', depositRollupVk);

      console.time('compile anomixEntryContract');
      await AnomixEntryContract.compile();
      this.isEntryContractCompiled = true;

      this.broadcastChannel?.postMessage({
        eventType: SdkEventType.ENTRY_CONTRACT_COMPILED_DONE,
      } as SdkEvent);
      console.timeEnd('compile anomixEntryContract');
      this.log.info(
        'anomixEntryContract vk hash: ',
        AnomixEntryContract._verificationKey!.hash.toString()
      );

      this.log.info(
        'Compile EntryContract(contain dependency: VaultContract) done'
      );
    } else {
      this.log.info('EntryContract already compiled');
    }
  }

  public async compilePrivateCircuit() {
    this.log.info('Compile Private Circuit...');

    if (!this.isPrivateCircuitCompiled) {
      console.time('compile private circuit');
      let { verificationKey } = await JoinSplitProver.compile();
      this.isPrivateCircuitCompiled = true;

      this.broadcastChannel?.postMessage({
        eventType: SdkEventType.PRIVATE_CIRCUIT_COMPILED_DONE,
      } as SdkEvent);
      console.timeEnd('compile private circuit');
      this.log.info('private circuit vk: ', verificationKey);
      this.log.info('Compile Private Circuit done');
    } else {
      this.log.info('Private Circuit already compiled');
    }
  }

  public privateCircuitCompiled() {
    return this.isPrivateCircuitCompiled;
  }

  public entryContractCompiled() {
    return this.isEntryContractCompiled;
  }

  public vaultContractCompiled() {
    return this.isVaultContractCompiled;
  }

  public async start(useSyncerWorker = false) {
    this.useSyncerWorker = useSyncerWorker;
    if (this.useSyncerWorker) {
      this.log.info('Use syncer worker to start');
      this.log.info('current env - isNode: ', isNode);
      if (isNode) {
        throw new Error('Syncer worker is not supported in nodejs environment');
        // this.syncerWorker = new NodeWorker(
        //   _dirname.concat('/syncer/syncer_worker.js'),
        //   {
        //     workerData: {
        //       memory: new WebAssembly.Memory({
        //         initial: 20,
        //         maximum: 5000,
        //         shared: true,
        //       }),
        //     },
        //   }
        // );
        // this.remoteSyncer = wrap<SyncerWrapper>(
        //   nodeEndpoint(this.syncerWorker)
        // );
      } else {
        this.syncerWorker = new Worker(
          new URL('./syncer/syncer_worker.js', import.meta.url),
          {
            type: 'module',
          }
        );
        this.remoteSyncer = wrap<SyncerWrapper>(this.syncerWorker);
      }
      this.log.debug('worker init done');
      try {
        await this.remoteSyncer.create(this.options);
        await this.remoteSyncer.start();
      } catch (err) {
        this.log.error(err);
        throw err;
      }
    } else {
      await this.syncer.start(
        1,
        this.options.synceBlocksPerPoll !== undefined
          ? this.options.synceBlocksPerPoll
          : 1,
        this.options.l2BlockPollingIntervalMS
          ? this.options.l2BlockPollingIntervalMS
          : 1000
      );
    }

    this.broadcastChannel?.postMessage({
      eventType: SdkEventType.STARTED,
    } as SdkEvent);
    const host = this.node.getHost();
    this.log.info(`Started, using node at ${host}`);
  }

  public async stop() {
    if (this.useSyncerWorker) {
      await this.remoteSyncer.stop();
      // @ts-ignore
      await this.syncerWorker.terminate();
    } else {
      await this.syncer.stop();
    }

    await this.db.close();
    await this.keyStore.lock();

    this.broadcastChannel?.postMessage({
      eventType: SdkEventType.STOPPED,
    } as SdkEvent);
    this.log.info('Stopped');
  }

  private async checkRunningState() {
    let isRunning = false;
    if (this.useSyncerWorker) {
      isRunning = await this.remoteSyncer.isRunning();
    } else {
      isRunning = this.syncer.isRunning();
    }
    if (!isRunning) {
      throw new Error(
        `Sdk syncer is not running, please call start() before calling this method.`
      );
    }
  }

  public async isSynced() {
    await this.checkRunningState();

    if (this.useSyncerWorker) {
      return await this.remoteSyncer.isSynced();
    } else {
      return await this.syncer.isSynced();
    }
  }

  public async awaitSynced(timeout?: number) {
    await retryUntil(() => this.isSynced(), 'data synced', timeout);
  }

  public async isAccountSynced(accountPk: string) {
    await this.checkRunningState();

    if (this.useSyncerWorker) {
      return await this.remoteSyncer.isAccountSynced(accountPk);
    } else {
      return await this.syncer.isAccountSynced(accountPk);
    }
  }

  public async awaitAccountSynced(accountPk: string, timeout?: number) {
    await retryUntil(
      () => this.isAccountSynced(accountPk),
      `account synced ${accountPk}`,
      timeout
    );
  }

  public generateKeyPair(
    sign: Signature,
    accountIndex = 0
  ): {
    privateKey: PrivateKey;
    publicKey: PublicKey;
  } {
    return genNewKeyPairBySignature(sign, accountIndex);
  }

  public generateKeyPairByProviderSignature(
    sign: ProviderSignature,
    accountIndex = 0
  ) {
    const signature = convertProviderSignatureToSignature(sign);
    return this.generateKeyPair(signature, accountIndex);
  }

  public getAccountKeySigningData(): string {
    return 'Sign this message to generate your Anomix Account Key. This key lets the application decrypt your balance on Anomix.\n\nIMPORTANT: Only sign this message if you trust the application.';
  }

  public async searchRelatedTx(detectionKey: DetectionKey) {
    const dk = detectionKey.toHex();
    return await this.node.searchRelatedTx(dk);
  }

  public async generateAccountKeyPair(
    signer: MinaSignerProvider,
    accountIndex = 0
  ) {
    const signingData = this.getAccountKeySigningData();
    const signedData = await signer.signMessage({ message: signingData });
    const sign = Signature.fromObject({
      r: Field(signedData.signature.field),
      s: Scalar.fromJSON(signedData.signature.scalar),
    });

    return this.generateKeyPair(sign, accountIndex);
  }

  public getSigningKeySigningData() {
    return 'Sign this message to generate your Anomix Signing Key. This key lets the application spend your funds on Anomix.\n\nIMPORTANT: Only sign this message if you trust the application.';
  }

  public async generateSigningKeyPair(
    signer: MinaSignerProvider,
    accountIndex = 0
  ) {
    const signingData = this.getSigningKeySigningData();
    const signedData = await signer.signMessage({ message: signingData });
    const sign = Signature.fromObject({
      r: Field(signedData.signature.field),
      s: Scalar.fromJSON(signedData.signature.scalar),
    });

    return this.generateKeyPair(sign, accountIndex);
  }

  public async unlockKeyStore(cachePubKeys: string[], pwd: string) {
    await this.keyStore.unlock(cachePubKeys, pwd);
  }

  public lockKeyStore() {
    this.keyStore.lock();
  }

  public async addSecretKey(
    privateKey: PrivateKey,
    pwd: string,
    isCached = true
  ): Promise<PublicKey> {
    return await this.keyStore.addAccount(privateKey, pwd, isCached);
  }

  public async getSecretKey(
    publicKey: PublicKey,
    pwd?: string
  ): Promise<PrivateKey | undefined> {
    return await this.keyStore.getAccountPrivateKey(publicKey, pwd);
  }

  public async getAliasByAccountPublicKey(
    accountPk: string,
    accountPrivateKey: PrivateKey
  ) {
    try {
      const res = await this.node.getAliasByAccountPublicKey(accountPk);
      if (res) {
        const alias = decryptAlias(res.aliasInfo, res.alias, accountPrivateKey);
        return alias;
      }
    } catch (err) {
      this.log.error(err);
      throw err;
    }
  }

  public async isAccountRegistered(
    accountPk: string,
    includePending: boolean
  ): Promise<boolean> {
    return await this.node.isAccountRegistered(accountPk, includePending);
  }

  public async isAliasRegistered(
    alias: string,
    includePending: boolean
  ): Promise<boolean> {
    const aliasFields = Encoding.Bijective.Fp.fromString(alias);
    const aliasHash = Poseidon.hash(aliasFields).toString();
    return await this.node.isAliasRegistered(aliasHash, includePending);
  }

  public async isAliasRegisterdToAccount(
    aliasHash: string,
    accountPk: string,
    includePending: boolean
  ): Promise<boolean> {
    return await this.node.isAliasRegisteredToAccount(
      aliasHash,
      accountPk,
      includePending
    );
  }

  private computeAliasHashField(alias: string): Field {
    return Poseidon.hash(Encoding.Bijective.Fp.fromString(alias));
  }

  private computeAliasHash(alias: string): string {
    return this.computeAliasHashField(alias).toString();
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

  public async getBlockHeight() {
    return await this.node.getBlockHeight();
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

  public async getClaimableNotes(commitments: string[], l1address?: string) {
    return await this.node.getClaimableNotes(commitments, l1address);
  }

  public async localAccountExists(accountPk: string) {
    const userState = await this.db.getUserState(accountPk);
    if (userState) {
      return true;
    }

    return false;
  }

  public async withdrawAccountExists(userAddress: string) {
    const res = await fetchAccount({
      publicKey: userAddress,
      tokenId: this.vaultContract.token.id,
    });

    if (res.account) {
      return true;
    }

    return false;
  }

  public async getL1Account(address: string, tokenId?: string) {
    const res = await fetchAccount({
      publicKey: address,
      tokenId,
    });

    if (res.error) {
      throw new Error(JSON.stringify(res.error));
    }

    return res.account;
  }

  public async getAccounts() {
    const userStates = await this.db.getUserStates();
    return userStates;
  }

  public async resetAccounts() {
    await this.db.resetUserStates();
  }

  public async getSigningKeys(accountPk: string) {
    return await this.db.getSigningKeys(accountPk);
  }

  public async updateAliasForUserState(accountPk: string, alias: string) {
    await this.db.updateAliasOfUserState(accountPk, alias);
  }

  public async loginAccount(accountPk: string, pwd: string, alias?: string) {
    this.log.info('Logging in account...');

    if (alias) {
      await this.db.updateAliasOfUserState(accountPk, alias);
    }

    const sigingKeys = await this.db.getSigningKeys(accountPk);
    if (sigingKeys.length === 0) {
      throw new Error('No signing keys found for account');
    }

    const pubKeys = sigingKeys.map((sk) => sk.signingPk);
    pubKeys.push(accountPk);
    await this.keyStore.unlock(pubKeys, pwd);

    if (this.useSyncerWorker) {
      await this.remoteSyncer.addAccount(accountPk);
    } else {
      this.syncer.addAccount(PublicKey.fromBase58(accountPk));
    }

    this.log.info('Account logged in');

    return {
      pubKeys,
    };
  }

  public async removeUserState(accountPk58: string) {
    this.log.info('Removing user state...');
    await this.db.removeUserState(accountPk58);
    this.log.info('User state removed');
  }

  public async syncerRemoveAccount(accountPk58: string) {
    this.log.info('Syncer removing account...');
    if (this.useSyncerWorker) {
      await this.remoteSyncer.removeAccount(accountPk58);
    } else {
      this.syncer.removeAccount(PublicKey.fromBase58(accountPk58));
    }
    this.log.info('Syncer account removed');
  }

  public async addAccount(
    accountPrivateKey: PrivateKey,
    pwd: string,
    signingPrivateKey1?: PrivateKey,
    signingPrivateKey2?: PrivateKey,
    alias?: string
  ) {
    this.log.info('Adding account...');
    const accountPk = accountPrivateKey.toPublicKey();
    const accountPk58 = accountPk.toBase58();

    const us = await this.db.getUserState(accountPk58);
    if (us === undefined) {
      await this.db.upsertUserState(new UserState(accountPk58, 0, alias));
    } else {
      if (us.alias === undefined && alias !== undefined) {
        await this.db.updateAliasOfUserState(accountPk58, alias);
      }
    }

    await this.keyStore.addAccount(accountPrivateKey, pwd, true);

    let signingPubKey1: string | undefined = undefined;
    let signingPubKey2: string | undefined = undefined;

    if (signingPrivateKey1) {
      signingPubKey1 = signingPrivateKey1.toPublicKey().toBase58();
      const signingKey1 = {
        signingPk: signingPubKey1,
        accountPk: accountPk58,
      };
      await this.db.upsertSigningKey(signingKey1);
      await this.keyStore.addAccount(signingPrivateKey1, pwd, true);
    }

    if (signingPrivateKey2) {
      signingPubKey2 = signingPrivateKey2.toPublicKey().toBase58();
      const signingKey2 = {
        signingPk: signingPubKey2,
        accountPk: accountPk58,
      };
      await this.db.upsertSigningKey(signingKey2);
      await this.keyStore.addAccount(signingPrivateKey2, pwd, true);
    }

    if (this.useSyncerWorker) {
      await this.remoteSyncer.addAccount(accountPk58);
    } else {
      this.syncer.addAccount(accountPk);
    }

    this.log.info(`added account: ${accountPk58}`);

    return {
      accountPk: accountPk58,
      signingPubKey1,
      signingPubKey2,
    };
  }

  public async getAccountSyncedToBlock(accountPk: string) {
    const userState = await this.db.getUserState(accountPk);
    return userState?.syncedToBlock;
  }

  public async getSigningPublicKeys(accountPk: string) {
    const keys = await this.db.getSigningKeys(accountPk);
    return keys.map((k) => PublicKey.fromBase58(k.signingPk));
  }

  public async getBalance(
    accountPk: string,
    assetId: string = AssetId.MINA.toString()
  ) {
    let unspentNotes = await this.db.getNotes(
      accountPk,
      NoteType.NORMAL.toString()
    );
    unspentNotes = unspentNotes.filter((n) => !n.pending);
    let balance = 0n;
    for (let i = 0; i < unspentNotes.length; i++) {
      const note = unspentNotes[i];
      if (note.assetId === assetId) {
        balance = balance + BigInt(unspentNotes[i].value);
      }
    }

    return balance;
  }

  public async getWithdrawNotes(
    accountPk: string,
    assetId: string = AssetId.MINA.toString()
  ) {
    const notes = await this.db.getNotes(
      accountPk,
      NoteType.WITHDRAWAL.toString()
    );
    return notes.filter((n) => n.assetId === assetId);
  }

  // will update finalizedAt of every tx
  public async getUserTxs(accountPk: string) {
    let txs = await this.db.getUserTxs(accountPk);

    try {
      const unFinalizedTx = txs.filter((v) => v.finalizedTs === 0);
      const blockSet = new Set<number>();
      unFinalizedTx.forEach((v) => {
        blockSet.add(v.block);
      });
      const unFinalizedBlocks = [...blockSet];
      this.log.debug('unFinalizedBlocks: ', unFinalizedBlocks);

      if (unFinalizedBlocks.length > 0) {
        const blockFinalizedTimeObj = await this.node.getFinalizedTimeOfBlocks(
          unFinalizedBlocks
        );
        this.log.debug('blockFinalizedTimeObj: ', blockFinalizedTimeObj);
        let updatedUserTxs: UserTx[] = [];
        for (let i = 0; i < txs.length; i++) {
          const blockKey = txs[i].block + '';
          const currentFinalizedAt = blockFinalizedTimeObj[blockKey];
          if (currentFinalizedAt && currentFinalizedAt > 0) {
            txs[i].finalizedTs = currentFinalizedAt;
            updatedUserTxs.push(txs[i]);
          }
        }

        this.log.debug('updatedUserTxs: ', updatedUserTxs);
        await this.db.upsertUserTxs(updatedUserTxs);
      }
    } catch (err: any) {
      console.error(err);
      this.log.error('Failed to get finalized time of blocks: ', err);
    }

    return txs;
  }

  public async getPendingUserTxs(accountPk: string) {
    return await this.db.getPendingUserTxs(accountPk);
  }

  public async sendTx(tx: Tx) {
    await this.node.sendTx(tx.provedTx);
    if (tx.txInfo.originTx) {
      if (tx.txInfo.actionType === ActionType.ACCOUNT.toString()) {
        await this.db.upsertUserAccountTx(tx.txInfo.originTx as UserAccountTx);
      } else {
        await this.db.upsertUserPaymentTx(tx.txInfo.originTx as UserPaymentTx);
      }
    }

    if (tx.txInfo.spendNullifiers) {
      let pendingNullifiers: PendingNullifier[] = [];
      for (const nullifier of tx.txInfo.spendNullifiers) {
        pendingNullifiers.push(
          new PendingNullifier(tx.txInfo.originTx.accountPk, nullifier)
        );
      }
      await this.db.upsertPendingNullifiers(pendingNullifiers);
    }

    if (tx.txInfo.originOutputNotes) {
      await this.db.upsertNotes(tx.txInfo.originOutputNotes);
    }
  }

  public async createDeployWithdrawAccountTx({
    userAddress,
    feePayerAddress,
    suggestedTxFee,
  }: {
    userAddress: PublicKey;
    feePayerAddress: PublicKey;
    suggestedTxFee?: UInt64;
  }) {
    this.log.info('create withdraw account...');
    if (!this.isVaultContractCompiled) {
      throw new Error('Vault contract is not compiled');
    }

    let txFee = suggestedTxFee
      ? suggestedTxFee
      : UInt64.from(DEFAULT_L1_TX_FEE);
    let transaction = await Mina.transaction(
      { sender: feePayerAddress, fee: txFee },
      () => {
        AccountUpdate.fundNewAccount(feePayerAddress);
        this.vaultContract.deployAccount(
          WithdrawAccount._verificationKey!,
          userAddress
        );
      }
    );

    this.log.info(`prove deploy withdraw account tx...`);
    await transaction.prove();
    return transaction.toJSON();
  }

  public async createClaimFundsTx({
    withdrawNoteCommitment,
    feePayerAddress,
    suggestedTxFee,
  }: {
    withdrawNoteCommitment: string;
    feePayerAddress: PublicKey;
    suggestedTxFee?: UInt64;
  }) {
    this.log.info('create claim funds tx...');
    if (!this.isVaultContractCompiled) {
      throw new Error('Vault contract is not compiled');
    }

    const claimInfo = await this.node.getFundsClaimInfo(withdrawNoteCommitment);
    const withdrawNoteWitnessData = WithdrawNoteWitnessData.fromDTO(
      claimInfo.withdrawNoteWitnessData
    );
    const lowLeafWitness = UserLowLeafWitnessData.fromDTO(
      claimInfo.lowLeafWitness
    );
    const oldNullWitness = UserNullifierMerkleWitness.fromJSON({
      path: claimInfo.oldNullWitness,
    });
    const rollupDataRoot = Field(claimInfo.rollupDataRoot);
    const fundsReceiver = withdrawNoteWitnessData.withdrawNote.ownerPk;

    let txFee = suggestedTxFee
      ? suggestedTxFee
      : UInt64.from(DEFAULT_L1_TX_FEE);

    // cache account for contract execution
    await fetchAccount({ publicKey: this.vaultContract.address });
    await fetchAccount({
      publicKey: fundsReceiver,
    });
    await fetchAccount({
      publicKey: fundsReceiver,
      tokenId: this.vaultContract.token.id,
    });

    let transaction = await Mina.transaction(
      { sender: feePayerAddress, fee: txFee },
      () => {
        this.vaultContract.withdraw(
          withdrawNoteWitnessData,
          lowLeafWitness,
          oldNullWitness,
          rollupDataRoot
        );
      }
    );

    this.log.info(`prove deploy withdraw account tx...`);
    await transaction.prove();
    return transaction.toJSON();
  }

  public async createDepositTx({
    payerAddress,
    receiverAddress,
    feePayerAddress,
    suggestedTxFee,
    amount,
    assetId,
    anonymousToReceiver,
    receiverAccountRequired,
    noteEncryptPrivateKey,
  }: {
    payerAddress: PublicKey;
    receiverAddress: PublicKey;
    feePayerAddress: PublicKey;
    suggestedTxFee?: UInt64;
    amount: UInt64;
    assetId?: Field;
    anonymousToReceiver?: boolean;
    receiverAccountRequired: Field;
    noteEncryptPrivateKey: PrivateKey;
  }) {
    this.log.info(`create deposit proof...`);
    if (!this.isEntryContractCompiled) {
      throw new Error('Entry contract is not compiled');
    }

    if (assetId === undefined) {
      assetId = AssetId.MINA;
    }

    if (anonymousToReceiver === undefined) {
      anonymousToReceiver = false;
    }

    const note = new ValueNote({
      secret: Field.random(),
      ownerPk: receiverAddress,
      accountRequired: receiverAccountRequired,
      creatorPk: anonymousToReceiver ? PublicKey.empty() : payerAddress,
      value: amount,
      assetId,
      inputNullifier: Poseidon.hash(payerAddress.toFields()),
      noteType: NoteType.NORMAL,
    });

    const noteFieldData = await encryptValueNoteToFieldData(
      note,
      noteEncryptPrivateKey
    );

    let txFee = suggestedTxFee
      ? suggestedTxFee
      : UInt64.from(DEFAULT_L1_TX_FEE);
    const entryContract = this.entryContract;

    // cache account for run circuit
    await fetchAccount({ publicKey: this.vaultContract.address });
    await fetchAccount({ publicKey: entryContract.address });
    let transaction = await Mina.transaction(
      { sender: feePayerAddress, fee: txFee },
      () => {
        entryContract.deposit(payerAddress, note, noteFieldData);
      }
    );

    this.log.info(`prove deposit tx...`);
    await transaction.prove();
    return transaction.toJSON();
  }

  public async encryptNotes(notes: ValueNote[], accountPrivateKey: PrivateKey) {
    let encryptedNotes: EncryptedNote[] = [];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const commitment = note.commitment();
      const accountKeyBigInt = accountPrivateKey.toBigInt();
      const accountPkBigint = derivePublicKeyBigInt(
        accountPrivateKey.toPublicKey()
      );
      const senderNewKeyPair = genNewKeyPairForNote(
        accountKeyBigInt,
        commitment.toBigInt()
      );
      const senderNewKey = senderNewKeyPair.privateKey;
      const shareSecret = calculateShareSecret(senderNewKey, note.ownerPk);

      const cipherText = await encrypt(
        JSON.stringify(ValueNote.toJSON(note)),
        commitment.toString(),
        shareSecret
      );
      encryptedNotes.push({
        cipherText,
        noteCommitment: commitment.toString(),
        publicKey: senderNewKeyPair.publicKey.toBase58(),
        receiverInfo: maskReceiverBySender(
          note.ownerPk,
          accountPkBigint,
          commitment.toBigInt()
        ).map((v) => v.toString()),
      });
    }

    return encryptedNotes;
  }

  public async getAnalysisOfNotes(accountPk: string): Promise<{
    availableNotesNum: number;
    pendingNotesNum: number;
    maxSpendValuePerTx: string;
  }> {
    const notes = await this.db.getNotes(accountPk, NoteType.NORMAL.toString());
    const pendingNullifiers = await this.getPendingNullifiers(accountPk);
    const sortedNotes = notes
      .filter((n) => !n.pending)
      .filter((n) => !pendingNullifiers.includes(n.nullifier))
      .sort((a, b) => Number(BigInt(b.value) - BigInt(a.value)));
    const pendingNotes = notes.filter((n) => n.pending);

    if (sortedNotes.length === 0) {
      return {
        availableNotesNum: 0,
        pendingNotesNum: pendingNotes.length,
        maxSpendValuePerTx: '0',
      };
    } else if (sortedNotes.length === 1) {
      return {
        availableNotesNum: 1,
        pendingNotesNum: pendingNotes.length,
        maxSpendValuePerTx: sortedNotes[0].value,
      };
    } else {
      return {
        availableNotesNum: sortedNotes.length,
        pendingNotesNum: pendingNotes.length,
        maxSpendValuePerTx:
          BigInt(sortedNotes[0].value) + BigInt(sortedNotes[1].value) + '',
      };
    }
  }

  public async getPendingNullifiers(accountPk: string) {
    let pendingNullifiers: string[] = [];
    const pendingTxs = await this.db.getPendingUserTxs(accountPk);
    if (pendingTxs.length === 0) {
      await this.db.removePendingNullifiers(accountPk);
    } else {
      pendingNullifiers = await this.db.getPendingNullifiers(accountPk);
    }

    return pendingNullifiers;
  }

  public async createPaymentTx({
    accountPk,
    alias,
    senderAccountRequired,
    receiver,
    receiverAccountRequired,
    anonymousToReceiver,
    payAmount,
    payAssetId,
    txFee,
    isWithdraw,
  }: {
    accountPk: PublicKey;
    alias: string | null;
    senderAccountRequired: Field;
    receiver: PublicKey;
    receiverAccountRequired: Field;
    anonymousToReceiver: boolean;
    payAmount: UInt64;
    payAssetId: Field;
    txFee: UInt64;
    isWithdraw: boolean;
  }) {
    this.log.info('create payment tx...');

    if (!this.isPrivateCircuitCompiled) {
      throw new Error('Private circuit is not compiled');
    }

    const accountPk58 = accountPk.toBase58();
    const notes = await this.db.getNotes(
      accountPk58,
      NoteType.NORMAL.toString()
    );
    if (notes.length === 0) {
      throw new Error('No available notes');
    }

    const pendingNullifiers = await this.getPendingNullifiers(accountPk58);
    const picker = new NotePicker(notes);
    const unspentNotes = picker.pick(
      payAmount.toBigInt(),
      payAssetId.toString(),
      senderAccountRequired.toString(),
      pendingNullifiers
    );

    let inputValueNote1: ValueNote = ValueNote.zero();
    let inputValueNote2: ValueNote = ValueNote.zero();
    let outputNote1: ValueNote = ValueNote.zero();
    let outputNote2: ValueNote = ValueNote.zero();
    let inputNoteNum: Field = Field(0);
    let inputNote1Index: Field = Field(0);
    let inputNote2Index: Field = Field(0);
    let inputNote1Witness: DataMerkleWitness =
      DataMerkleWitness.zero(DUMMY_FIELD);
    let inputNote2Witness: DataMerkleWitness =
      DataMerkleWitness.zero(DUMMY_FIELD);
    let accountNoteIndex: Field = Field(0);
    let accountNoteWitness: DataMerkleWitness =
      DataMerkleWitness.zero(DUMMY_FIELD);

    const aliasHash =
      alias !== null ? this.computeAliasHashField(alias) : Field(0);
    const aliasHashStr = aliasHash.toString();
    const aliases = await this.db.getAliasesByAliasHash(aliasHashStr);
    if (aliases.length > 0) {
      accountNoteIndex = Field(aliases[0].index);
      this.log.info(
        `getMerkleWitnessesByCommitments... aliases[0].noteCommitment: ${aliases[0].noteCommitment} `
      );
      const witnessDtos = await this.node.getMerkleWitnessesByCommitments([
        aliases[0].noteCommitment!,
      ]);
      if (witnessDtos.length === 0) {
        throw new Error(
          `getMerkleWitnessesByCommitments failed, commitment: ${aliases[0].noteCommitment}`
        );
      }
      this.log.debug('accountNoteWitness: ', witnessDtos[0]);
      accountNoteWitness = DataMerkleWitness.fromMerkleProofDTO(witnessDtos[0]);
    }
    let signingPk = accountPk;

    const accountPrivateKey = await this.keyStore.getAccountPrivateKey(
      accountPk
    );
    if (accountPrivateKey === undefined) {
      throw new Error('AccountPrivateKey cannot be found in keyStore');
    }

    this.log.info('check isAccountRegistered...');
    if (
      await this.isAliasRegisterdToAccount(aliasHashStr, accountPk58, false)
    ) {
      signingPk = PublicKey.fromBase58(aliases[0].signingPk!);
    }
    const publicValue = isWithdraw ? payAmount : UInt64.zero;
    const publicOwner = isWithdraw ? receiver : PublicKey.empty();
    const dataRoot = Field(
      await (
        await this.node.getWorldState()
      ).dataTree.root
    );
    let nullifier1 = DUMMY_FIELD;
    let nullifier2 = DUMMY_FIELD;

    // When unspentNotes only 1
    if (unspentNotes.length === 1) {
      inputNoteNum = Field(1);
      const inputNote = unspentNotes[0];
      inputValueNote1 = unspentNotes[0].valueNote;
      inputNote1Index = Field(inputNote.index!);

      this.log.info(
        `getMerkleWitnessesByCommitments... inputNote.commitment: ${inputNote.commitment} `
      );
      const witessDtos = await this.node.getMerkleWitnessesByCommitments([
        inputNote.commitment!,
      ]);
      if (witessDtos.length === 0) {
        throw new Error(
          `getMerkleWitnessesByCommitments failed, commitment: ${inputNote.commitment}`
        );
      }
      inputNote1Witness = DataMerkleWitness.fromMerkleProofDTO(witessDtos[0]);
      nullifier1 = calculateNoteNullifier(
        Field(inputNote.commitment),
        accountPrivateKey,
        Bool(true)
      );
      inputValueNote2.secret = Field.random();
      nullifier2 = calculateNoteNullifier(
        inputValueNote2.commitment(),
        accountPrivateKey,
        Bool(false)
      );
      const balance = BigInt(inputNote.value);
      const amountLeftOver = balance - payAmount.toBigInt() - txFee.toBigInt();

      if (amountLeftOver < 0n) {
        throw new Error('No unspent note that meets the requirement');
      } else if (amountLeftOver === 0n) {
        outputNote1 = new ValueNote({
          secret: Field.random(),
          ownerPk: receiver,
          accountRequired: receiverAccountRequired,
          creatorPk: isWithdraw
            ? PublicKey.empty()
            : anonymousToReceiver
            ? PublicKey.empty()
            : accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: isWithdraw ? NoteType.WITHDRAWAL : NoteType.NORMAL,
        });
      } else {
        outputNote1 = new ValueNote({
          secret: Field.random(),
          ownerPk: receiver,
          accountRequired: receiverAccountRequired,
          creatorPk: isWithdraw
            ? PublicKey.empty()
            : anonymousToReceiver
            ? PublicKey.empty()
            : accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: isWithdraw ? NoteType.WITHDRAWAL : NoteType.NORMAL,
        });

        outputNote2 = new ValueNote({
          secret: Field.random(),
          ownerPk: accountPk,
          accountRequired: senderAccountRequired,
          creatorPk: accountPk,
          value: UInt64.from(amountLeftOver),
          assetId: payAssetId,
          inputNullifier: nullifier2,
          noteType: NoteType.NORMAL,
        });
      }
    } else {
      inputNoteNum = Field(2);
      const inputNote1 = unspentNotes[0];
      inputNote1Index = Field(inputNote1.index!);
      inputValueNote1 = inputNote1.valueNote;
      const inputNote2 = unspentNotes[1];
      inputNote2Index = Field(inputNote2.index!);
      inputValueNote2 = inputNote2.valueNote;

      nullifier1 = calculateNoteNullifier(
        Field(inputNote1.commitment),
        accountPrivateKey,
        Bool(true)
      );
      nullifier2 = calculateNoteNullifier(
        Field(inputNote2.commitment),
        accountPrivateKey,
        Bool(true)
      );

      const inputNoteWitnesses =
        await this.node.getMerkleWitnessesByCommitments([
          inputNote1.commitment!,
          inputNote2.commitment,
        ]);
      this.log.debug('inputNoteWitnesses: ', inputNoteWitnesses);
      inputNote1Witness = DataMerkleWitness.fromMerkleProofDTO(
        inputNoteWitnesses[0]
      );
      inputNote2Witness = DataMerkleWitness.fromMerkleProofDTO(
        inputNoteWitnesses[1]
      );

      const balance = BigInt(inputNote1.value) + BigInt(inputNote2.value);
      const amountLeftOver = balance - payAmount.toBigInt() - txFee.toBigInt();

      if (amountLeftOver < 0n) {
        throw new Error('No unspent note that meets the requirement');
      } else if (amountLeftOver === 0n) {
        outputNote1 = new ValueNote({
          secret: Field.random(),
          ownerPk: receiver,
          accountRequired: receiverAccountRequired,
          creatorPk: isWithdraw
            ? PublicKey.empty()
            : anonymousToReceiver
            ? PublicKey.empty()
            : accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: isWithdraw ? NoteType.WITHDRAWAL : NoteType.NORMAL,
        });
      } else {
        outputNote1 = new ValueNote({
          secret: Field.random(),
          ownerPk: receiver,
          accountRequired: receiverAccountRequired,
          creatorPk: isWithdraw
            ? PublicKey.empty()
            : anonymousToReceiver
            ? PublicKey.empty()
            : accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: isWithdraw ? NoteType.WITHDRAWAL : NoteType.NORMAL,
        });

        outputNote2 = new ValueNote({
          secret: Field.random(),
          ownerPk: accountPk,
          accountRequired: senderAccountRequired,
          creatorPk: accountPk,
          value: UInt64.from(amountLeftOver),
          assetId: payAssetId,
          inputNullifier: nullifier2,
          noteType: NoteType.NORMAL,
        });
      }
    }
    outputNote2.inputNullifier = nullifier2;

    let outputNote2Commitment = outputNote2.commitment();

    const outputValueNotes = [outputNote1];

    const originOutputNotes: Note[] = [];

    const isOutputNote2Empty = outputNote2.value
      .equals(UInt64.zero)
      .toBoolean();
    if (isOutputNote2Empty) {
      outputNote2Commitment = DUMMY_FIELD;
    } else {
      outputValueNotes.push(outputNote2);
      originOutputNotes.push(
        Note.from({
          valueNoteJSON: ValueNote.toJSON(outputNote2),
          commitment: outputNote2Commitment.toString(),
          nullifier: calculateNoteNullifier(
            outputNote2Commitment,
            accountPrivateKey,
            Bool(true)
          ).toString(),
          nullified: false,
        })
      );
    }

    const publicAssetId = isWithdraw ? AssetId.MINA : DUMMY_FIELD;
    const message = [
      outputNote1.commitment(),
      outputNote2.value.equals(UInt64.zero).toBoolean()
        ? DUMMY_FIELD
        : outputNote2.commitment(),
      nullifier1,
      nullifier2,
      publicAssetId,
      ...publicValue.toFields(),
      ...publicOwner.toFields(),
    ];
    let signingPrivateKey = await this.keyStore.getAccountPrivateKey(signingPk);
    if (signingPrivateKey === undefined) {
      throw new Error('signingPrivateKeyBase58 is undefined');
    }

    let signature: Signature;
    if (senderAccountRequired.equals(AccountRequired.REQUIRED).toBoolean()) {
      signature = Signature.create(signingPrivateKey, message);
    } else {
      signature = Signature.create(accountPrivateKey, message);
    }

    const input = new JoinSplitSendInput({
      actionType: isWithdraw ? ActionType.WITHDRAW : ActionType.SEND,
      assetId: payAssetId,
      inputNotesNum: inputNoteNum,
      inputNote1Index,
      inputNote2Index,
      inputNote1Witness,
      inputNote2Witness,
      inputNote1: inputValueNote1,
      inputNote2: inputValueNote2,
      outputNote1,
      outputNote2,
      aliasHash,
      accountPrivateKey,
      accountRequired: senderAccountRequired,
      accountNoteIndex,
      accountNoteWitness,
      signingPk,
      signature,
      dataRoot,
      publicValue,
      publicOwner,
    });
    this.log.info(
      'sendInput: ',
      JSON.stringify(JoinSplitSendInput.toJSON(input))
    );
    this.log.info('proving...');
    const startTime = Date.now();
    const proof = await JoinSplitProver.send(input);
    const endTime = Date.now();
    this.log.info(`proving time: ${endTime - startTime}ms`);

    const encryptedNotes = await this.encryptNotes(
      outputValueNotes,
      accountPrivateKey
    );
    const provedTx = {
      proof: proof.toJSON(),
      extraData: {
        outputNote1: encryptedNotes[0],
        outputNote2:
          encryptedNotes.length === 2 ? encryptedNotes[1] : undefined,
        withdrawNote: isWithdraw ? ValueNote.toJSON(outputNote1) : undefined,
      },
    } as L2TxReqDto;

    const txHash = proof.publicOutput.hash().toString();
    const originTx = UserPaymentTx.from({
      txHash: txHash,
      accountPk: accountPk58,
      actionType: proof.publicOutput.actionType.toString(),
      publicValue: proof.publicOutput.publicValue.toString(),
      publicAssetId: proof.publicOutput.publicAssetId.toString(),
      publicOwner: proof.publicOutput.publicOwner.toBase58(),
      txFee: proof.publicOutput.txFee.toString(),
      txFeeAssetId: proof.publicOutput.txFeeAssetId.toString(),
      depositRoot: proof.publicOutput.depositRoot.toString(),
      depositIndex: Number(proof.publicOutput.depositIndex.toString()),
      privateValue: payAmount.toString(),
      privateValueAssetId: payAssetId.toString(),
      withdrawNoteCommitment: isWithdraw
        ? proof.publicOutput.outputNoteCommitment1.toString()
        : undefined,
      sender: accountPk58,
      receiver: receiver.toBase58(),
      isSender: true,
      block: 0,
      createdTs: 0,
      finalizedTs: 0,
    });

    return {
      provedTx,
      txInfo: {
        actionType: isWithdraw
          ? ActionType.WITHDRAW.toString()
          : ActionType.SEND.toString(),
        originTx,
        originOutputNotes:
          originOutputNotes && originOutputNotes.length > 0
            ? originOutputNotes
            : undefined,
        spendNullifiers: [nullifier1.toString(), nullifier2.toString()],
      },
    } as Tx;
  }

  public async createAccountRegisterTx({
    accountPk,
    alias,
    newSigningPk1,
    newSigningPk2,
  }: {
    accountPk: PublicKey;
    alias: string;
    newSigningPk1: PublicKey;
    newSigningPk2: PublicKey;
  }) {
    this.log.info('create account register tx...');
    if (!this.isPrivateCircuitCompiled) {
      throw new Error('Private circuit is not compiled');
    }
    let newAccountPk = accountPk;
    let signingPk = accountPk;
    let aliasHash = Poseidon.hash(Encoding.Bijective.Fp.fromString(alias));
    let operationType = AccountOperationType.CREATE;
    let accountNoteIndex = Field(0);
    let accountNoteWitness = DataMerkleWitness.zero(DUMMY_FIELD);
    let dataRoot = Field((await this.node.getWorldState()).dataTree.root);
    let nullifier1 = Poseidon.hash([aliasHash]);
    let nullifier2 = Poseidon.hash(newAccountPk.toFields());

    const message = [
      aliasHash,
      ...accountPk.toFields(),
      ...newAccountPk.toFields(),
      ...newSigningPk1.toFields(),
      ...newSigningPk2.toFields(),
      nullifier1,
      nullifier2,
    ];

    const accountPrivateKey = await this.keyStore.getAccountPrivateKey(
      accountPk
    );
    if (accountPrivateKey === undefined) {
      throw new Error('AccountPrivateKey cannot be found in keyStore');
    }
    let signature = Signature.create(accountPrivateKey, message);

    const input = new JoinSplitAccountInput({
      accountPk,
      newAccountPk,
      signingPk,
      signature,
      newSigningPk1,
      newSigningPk2,
      aliasHash,
      operationType,
      accountNoteIndex,
      accountNoteWitness,
      dataRoot,
    });

    this.log.info('proving...');
    const startTime = Date.now();
    const proof = await JoinSplitProver.operateAccount(input);
    const endTime = Date.now();
    this.log.info(`proving time: ${endTime - startTime}ms`);

    const aliasInfo = await encryptAlias(alias, accountPrivateKey);
    const tx = {
      proof: proof.toJSON(),
      extraData: {
        aliasHash: aliasHash.toString(),
        acctPk: accountPk.toBase58(),
        aliasInfo,
      },
    } as L2TxReqDto;

    const originTx = UserAccountTx.from({
      txHash: proof.publicOutput.hash().toString(),
      accountPk: accountPk.toBase58(),
      aliasHash: aliasHash.toString(),
      alias,
      newSigningPk1: newSigningPk1.toBase58(),
      newSigningPk2: newSigningPk2.toBase58(),
      txFee: '0',
      txFeeAssetId: AssetId.MINA.toString(),
      migrated: false,
      block: 0,
      createdTs: 0,
      finalizedTs: 0,
    });

    return {
      provedTx: tx,
      txInfo: {
        actionType: ActionType.ACCOUNT.toString(),
        originTx,
        alias,
      },
    } as Tx;
  }

  public async isUserTxSettled(txHash: string) {
    return await this.db.isUserTxSettled(txHash);
  }
}
