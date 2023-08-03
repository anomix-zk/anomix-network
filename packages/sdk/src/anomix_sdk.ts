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
} from '@anomix/circuits';
import { EncryptedNote, L2TxReqDto, PoseidonHasher } from '@anomix/types';
import {
  calculateShareSecret,
  derivePublicKeyBigInt,
  encrypt,
  genNewKeyPairBySignature,
  genNewKeyPairForNote,
  maskReceiverBySender,
} from '@anomix/utils';
import { ConsolaInstance } from 'consola';
import {
  Bool,
  Encoding,
  Field,
  Mina,
  Poseidon,
  PrivateKey,
  PublicKey,
  Signature,
  UInt64,
} from 'snarkyjs';
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
  private entryContractAddress: PublicKey;
  private entryContract: AnomixEntryContract;

  public async init() {
    this.log.info('Initializing Anomix SDK, compile circuits...');
    console.time('compile');
    await DepositRollupProver.compile();
    await AnomixEntryContract.compile();
    console.timeEnd('compile');

    this.entryContract = new AnomixEntryContract(this.entryContractAddress);
  }

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

  public async createDepositTx(
    payerAddress: PublicKey,
    noteEncryptPrivateKey: PrivateKey,
    receiverAddress: PublicKey,
    amount: UInt64,
    assetId: Field,
    accountRequired: Field
  ) {
    const note = new ValueNote({
      secret: Field.random(),
      ownerPk: receiverAddress,
      accountRequired,
      creatorPk: payerAddress,
      value: amount,
      assetId,
      inputNullifier: Poseidon.hash(payerAddress.toFields()),
      noteType: NoteType.NORMAL,
    });

    const noteFieldData = await encryptValueNoteToFieldData(
      note,
      noteEncryptPrivateKey
    );

    let transaction = await Mina.transaction(() => {
      this.entryContract.deposit(payerAddress, note, noteFieldData);
    });

    this.log.info(`prove deposit tx...`);
    await transaction.prove().catch((err) => err);
    return transaction.toJSON();
  }

  private async pickUnspentNotes(
    accountPk: PublicKey,
    amount: UInt64,
    assetId: Field,
    accountRequired: Field
  ) {
    const unspentNotes = await this.db.getNotes(
      accountPk.toBase58(),
      NoteType.NORMAL.toString()
    );

    const filterNotes = unspentNotes
      .filter(
        (n) =>
          n.assetId === assetId.toString() &&
          n.ownerAccountRequired === accountRequired.toString()
      )
      .sort((a, b) => Number(BigInt(b.value) - BigInt(a.value)));

    if (filterNotes.length == 0) {
      throw new Error('No unspent note that meets the requirement');
    }
    if (filterNotes.length == 1) {
      if (BigInt(filterNotes[0].value) >= amount.toBigInt()) {
        return [filterNotes[0]];
      }

      throw new Error('No unspent note that meets the requirement');
    } else {
      if (
        BigInt(filterNotes[0].value) + BigInt(filterNotes[1].value) >=
        amount.toBigInt()
      ) {
        return [filterNotes[0], filterNotes[1]];
      }

      throw new Error('No unspent note that meets the requirement');
    }
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
          PublicKey.fromBase58(note.ownerPk),
          accountPkBigint,
          commitment.toBigInt()
        ).map((v) => v.toString()),
      });
    }

    return encryptedNotes;
  }

  public async sendPaymentTx(
    accountPk: PublicKey,
    accountPrivateKey: PrivateKey,
    aliasHash: Field,
    senderAccountRequired: Field,
    receiver: PublicKey,
    receiverAccountRequired: Field,
    payAmount: UInt64,
    payAssetId: Field,

    txFee: UInt64,
    pwd: string
  ) {
    const unspentNotes = await this.pickUnspentNotes(
      accountPk,
      payAmount,
      payAssetId,
      senderAccountRequired
    );
    let inputValueNote1 = ValueNote.zero();
    let inputValueNote2 = ValueNote.zero();
    let outputNote1: ValueNote = ValueNote.zero();
    let outputNote2: ValueNote = ValueNote.zero();
    let inputNoteNum = Field(0);
    let inputNote1Index = Field(0);
    let inputNote2Index = Field(0);
    let inputNote1Witness = DataMerkleWitness.zero(DUMMY_FIELD);
    let inputNote2Witness = DataMerkleWitness.zero(DUMMY_FIELD);
    let accountNoteIndex = Field(0);
    let accountNoteWitness = DataMerkleWitness.zero(DUMMY_FIELD);
    const aliases = await this.db.getAliasesByAliasHash(aliasHash.toString());
    if (aliases.length > 0) {
      accountNoteIndex = Field(aliases[0].index);
      accountNoteWitness = await this.node.getMerkleWitnessesByCommitments([
        aliases[0].noteCommitment!,
      ])[0];
    }
    let signingPk = accountPk;
    if (await this.isAccountRegistered(accountPk.toBase58())) {
      signingPk = PublicKey.fromBase58(aliases[0].signingPk!);
    }
    const publicValue = UInt64.zero;
    const publicOwner = PublicKey.empty();
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
      inputNote1Witness = await this.node.getMerkleWitnessesByCommitments([
        inputNote.commitment!,
      ])[0];
      nullifier1 = calculateNoteNullifier(
        Field(inputNote.commitment),
        accountPrivateKey,
        Bool(true)
      );
      nullifier2 = calculateNoteNullifier(
        ValueNote.zero().commitment(),
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
          creatorPk: accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: NoteType.NORMAL,
        });
      } else {
        outputNote1 = new ValueNote({
          secret: Field.random(),
          ownerPk: receiver,
          accountRequired: receiverAccountRequired,
          creatorPk: accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: NoteType.NORMAL,
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
          creatorPk: accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: NoteType.NORMAL,
        });
      } else {
        outputNote1 = new ValueNote({
          secret: Field.random(),
          ownerPk: receiver,
          accountRequired: receiverAccountRequired,
          creatorPk: accountPk,
          value: payAmount,
          assetId: payAssetId,
          inputNullifier: nullifier1,
          noteType: NoteType.NORMAL,
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

    const message = [
      outputNote1.commitment(),
      outputNote2.commitment(),
      nullifier1,
      nullifier2,
      DUMMY_FIELD,
      ...publicValue.toFields(),
      ...publicOwner.toFields(),
    ];
    let signingPrivateKey = await this.keyStore.getAccountPrivateKey(
      signingPk,
      pwd
    );
    if (signingPrivateKey === undefined) {
      throw new Error('signingPrivateKeyBase58 is undefined');
    }

    let signature = Signature.create(signingPrivateKey, message);

    const input = new JoinSplitSendInput({
      actionType: ActionType.SEND,
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

    this.log.info('proving...');
    const proof = await JoinSplitProver.send(input);

    const encryptedNotes = await this.encryptNotes(
      [outputNote1, outputNote2],
      accountPrivateKey
    );
    const tx = {
      proof: proof.toJSON(),
      extraData: {
        outputNote1: encryptedNotes[0],
        outputNote2: encryptedNotes[1],
      },
    } as L2TxReqDto;

    const res = await this.node.sendTx(tx);
    if (res.code !== 0) {
      throw new Error(res.msg);
    }

    return res.data;
  }

  public async sendAccountRegisterTx(
    accountPk: PublicKey,
    accountPrivateKey: PrivateKey,
    alias: string,
    newSigningPk1: PublicKey,
    newSigningPk2: PublicKey
  ) {
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
    const proof = await JoinSplitProver.operateAccount(input);

    const tx = {
      proof: proof.toJSON(),
      extraData: {
        aliasHash: aliasHash.toString(),
        acctPk: accountPk.toBase58(),
      },
    } as L2TxReqDto;

    const res = await this.node.sendTx(tx);
    if (res.code !== 0) {
      throw new Error(res.msg);
    }

    return res.data;
  }
}
