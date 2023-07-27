import { RollupProof } from '../block_prover/block_prover';
import {
  Bool,
  Permissions,
  Field,
  method,
  Provable,
  PublicKey,
  Signature,
  SmartContract,
  State,
  state,
  UInt32,
  VerificationKey,
  DeployArgs,
  Experimental,
  AccountUpdate,
  UInt64,
} from 'snarkyjs';
import {
  RollupBlockEvent,
  RollupState,
  WithdrawFundEvent,
  WithdrawNoteWitnessData,
} from './models';
import { AnomixEntryContract } from '../entry_contract/entry_contract';
import { BlockProveOutput } from '../block_prover/models';
import {
  INDEX_TREE_INIT_ROOT_16,
  INDEX_TREE_INIT_ROOT_20,
  MINA,
  STANDARD_TREE_INIT_ROOT_20,
} from '../constants';
import {
  LowLeafWitnessData,
  NullifierMerkleWitness,
} from '../models/merkle_witness';
import { AssetId, DUMMY_FIELD, NoteType } from '../models/constants';
import { checkMembershipAndAssert } from '../utils/utils';
import { ValueNote } from '../models/value_note';

function updateNullifierRootAndNullStartIndex(
  nullifierRoot: Field,
  nullStartIndex: Field,
  nullifier: Field,
  lowLeafWitness: LowLeafWitnessData,
  oldNullWitness: NullifierMerkleWitness
): { nullifierRoot: Field; nullStartIndex: Field } {
  nullifier.assertNotEquals(DUMMY_FIELD, 'nullifier is dummy field');

  // check nullifier not exist in nullifier tree
  lowLeafWitness.checkMembershipAndAssert(
    nullifierRoot,
    'lowLeafWitness is not valid'
  );

  nullifier
    .greaterThan(lowLeafWitness.leafData.value)
    .assertTrue(
      'Nullifier should not exist in null tree (nullifier <= lowLeafWitness.leafData.value)'
    );
  const lowLeafNextValue = lowLeafWitness.leafData.nextValue;
  Provable.if(
    lowLeafNextValue.equals(DUMMY_FIELD),
    Bool,
    Bool(true),
    nullifier.lessThan(lowLeafNextValue)
  ).assertTrue(
    'Nullifier should not exist in null tree (nullifier >= lowLeafWitness.leafData.nextValue)'
  );

  // check index and witness of nullifier
  checkMembershipAndAssert(
    DUMMY_FIELD,
    nullStartIndex,
    oldNullWitness,
    nullifierRoot,
    'oldNullWitness illegal'
  );

  // use index, witness and new nullifier to update null root
  const currentNullRoot = oldNullWitness.calculateRoot(
    nullifier,
    nullStartIndex
  );

  nullStartIndex = nullStartIndex.add(1);

  return { nullifierRoot: currentNullRoot, nullStartIndex };
}

export class WithdrawAccount extends SmartContract {
  @state(Field) nullifierRoot = State<Field>();
  @state(Field) nullStartIndex = State<Field>();

  @method updateState(
    nullifier: Field,
    lowLeafWitness: LowLeafWitnessData,
    oldNullWitness: NullifierMerkleWitness
  ): Field {
    const nullifierRoot = this.nullifierRoot.getAndAssertEquals();
    const nullStartIndex = this.nullStartIndex.getAndAssertEquals();

    const {
      nullifierRoot: currentNullRoot,
      nullStartIndex: currentNullStartIndex,
    } = updateNullifierRootAndNullStartIndex(
      nullifierRoot,
      nullStartIndex,
      nullifier,
      lowLeafWitness,
      oldNullWitness
    );
    this.nullifierRoot.set(currentNullRoot);
    this.nullStartIndex.set(currentNullStartIndex);

    this.self.body.mayUseToken = AccountUpdate.MayUseToken.ParentsOwnToken;

    return nullStartIndex;
  }
}

export class AnomixRollupContract extends SmartContract {
  static withdrawAccountVKHash: Field;
  static entryContractAddress: PublicKey;

  static escapeIntervalSlots = UInt32.from(40); // default: every 40 slots, 120 minutes
  static escapeSlots = UInt32.from(20); // default: 20 slots, 60 minutes, the period during which third parties are allowed to publish blocks

  @state(RollupState) state = State<RollupState>();
  @state(Field) blockNumber = State<Field>();
  @state(PublicKey) operatorAddress = State<PublicKey>();

  events = {
    blockEvent: RollupBlockEvent,
    withdrawFundEvent: WithdrawFundEvent,
  };

  deployRollup(args: DeployArgs, operatorAddress: PublicKey) {
    super.deploy(args);
    this.operatorAddress.set(operatorAddress);
  }

  @method init() {
    super.init();

    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    this.state.set(
      new RollupState({
        dataRoot: STANDARD_TREE_INIT_ROOT_20,
        nullifierRoot: INDEX_TREE_INIT_ROOT_20,
        dataRootsRoot: STANDARD_TREE_INIT_ROOT_20,
        depositStartIndex: Field(0),
      })
    );
    this.blockNumber.set(Field(0));
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
      receive: Permissions.none(),
      setVerificationKey: Permissions.proof(),
      access: Permissions.proof(),
    });
  }

  public get entryContract() {
    if (!AnomixRollupContract.entryContractAddress) {
      throw new Error('Anomix entry contract address unknown!');
    }
    return new AnomixEntryContract(AnomixRollupContract.entryContractAddress);
  }

  public get withdrawAccountVKHash() {
    if (!AnomixRollupContract.withdrawAccountVKHash) {
      throw new Error('Anomix withdraw account vk hash unknown!');
    }
    return AnomixRollupContract.withdrawAccountVKHash;
  }

  @method firstWithdraw(
    verificationKey: VerificationKey,
    withdrawNoteWitnessData: WithdrawNoteWitnessData,
    lowLeafWitness: LowLeafWitnessData,
    oldNullWitness: NullifierMerkleWitness
  ) {
    verificationKey.hash.assertEquals(this.withdrawAccountVKHash, 'invalid vk');

    const withdrawNote = withdrawNoteWitnessData.withdrawNote;
    withdrawNote.assetId.assertEquals(
      AssetId.MINA,
      'invalid asset id of withdraw note'
    );

    const userAddress = withdrawNote.ownerPk;
    userAddress.isEmpty().assertFalse('user address is empty');

    withdrawNote.noteType.assertEquals(
      NoteType.WITHDRAWAL,
      'invalid note type'
    );

    withdrawNote.value.assertGreaterThan(UInt64.zero, 'invalid note value');
    const commitment = withdrawNote.commitment();

    // check commitment exists in data tree
    const state = this.state.getAndAssertEquals();
    const dataRoot = state.dataRoot;
    checkMembershipAndAssert(
      commitment,
      withdrawNoteWitnessData.index,
      withdrawNoteWitnessData.witness,
      dataRoot,
      'withdrawNoteWitnessData illegal'
    );

    const tokenId = this.token.id;
    const deployUpdate = Experimental.createChildAccountUpdate(
      this.self,
      userAddress,
      tokenId
    );
    deployUpdate.account.permissions.set({
      receive: Permissions.none(),
      send: Permissions.proof(),
      editState: Permissions.proof(),
      editActionState: Permissions.proof(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
      access: Permissions.none(),
    });

    deployUpdate.account.verificationKey.set(verificationKey);
    deployUpdate.account.isNew.assertEquals(Bool(true));

    const nullifier = commitment;
    const initNullStartIndex = Field(0);
    const { nullifierRoot, nullStartIndex } =
      updateNullifierRootAndNullStartIndex(
        INDEX_TREE_INIT_ROOT_16,
        initNullStartIndex,
        nullifier,
        lowLeafWitness,
        oldNullWitness
      );

    AccountUpdate.setValue(deployUpdate.body.update.appState[0], nullifierRoot);
    AccountUpdate.setValue(
      deployUpdate.body.update.appState[1],
      nullStartIndex
    );
    deployUpdate.requireSignature();

    const userUpdate = AccountUpdate.createSigned(userAddress);
    // pay withdraw account creation fee
    userUpdate.balance.subInPlace(1n * MINA);

    // withdraw note value to user
    this.send({ to: userUpdate, amount: withdrawNote.value });

    this.emitEvent(
      'withdrawFundEvent',
      new WithdrawFundEvent({
        receiverAddress: userAddress,
        noteNullifier: nullifier,
        nullifierIndex: initNullStartIndex,
        amount: withdrawNote.value,
        assetId: withdrawNote.assetId,
      })
    );
  }

  @method withdraw(
    withdrawNoteWitnessData: WithdrawNoteWitnessData,
    lowLeafWitness: LowLeafWitnessData,
    oldNullWitness: NullifierMerkleWitness
  ) {
    const withdrawNote = withdrawNoteWitnessData.withdrawNote;
    withdrawNote.assetId.assertEquals(
      AssetId.MINA,
      'invalid asset id of withdraw note'
    );

    const userAddress = withdrawNote.ownerPk;
    userAddress.isEmpty().assertFalse('user address is empty');

    withdrawNote.noteType.assertEquals(
      NoteType.WITHDRAWAL,
      'invalid note type'
    );

    withdrawNote.value.assertGreaterThan(UInt64.zero, 'invalid note value');
    const commitment = withdrawNote.commitment();
    // check commitment exists in data tree
    const state = this.state.getAndAssertEquals();
    const dataRoot = state.dataRoot;
    checkMembershipAndAssert(
      commitment,
      withdrawNoteWitnessData.index,
      withdrawNoteWitnessData.witness,
      dataRoot,
      'withdrawNoteWitnessData illegal'
    );

    const tokenId = this.token.id;
    const withdrawAccount = new WithdrawAccount(userAddress, tokenId);
    const nullifier = commitment;

    const originNullStartIndex = withdrawAccount.updateState(
      nullifier,
      lowLeafWitness,
      oldNullWitness
    );

    const update = withdrawAccount.self;
    this.approve(update, AccountUpdate.Layout.AnyChildren);

    update.body.update.appState[0].isSome.assertTrue(
      'nullifierRoot should be change'
    );
    update.body.update.appState[1].isSome.assertTrue(
      'nullStartIndex should be change'
    );

    // withdraw note value to user
    this.send({ to: userAddress, amount: withdrawNote.value });

    this.emitEvent(
      'withdrawFundEvent',
      new WithdrawFundEvent({
        receiverAddress: userAddress,
        noteNullifier: nullifier,
        nullifierIndex: originNullStartIndex,
        amount: withdrawNote.value,
        assetId: withdrawNote.assetId,
      })
    );
  }

  @method updateRollupState(proof: RollupProof, operatorSign: Signature) {
    proof.verify();

    const globalSlots = this.network.globalSlotSinceGenesis.get();
    this.network.globalSlotSinceGenesis.assertBetween(
      globalSlots,
      globalSlots.add(1)
    );

    const output = proof.publicOutput;
    const signMessage = BlockProveOutput.toFields(output);
    const operatorAddress = this.operatorAddress.getAndAssertEquals();

    Provable.if(
      globalSlots
        .mod(AnomixRollupContract.escapeIntervalSlots)
        .lessThanOrEqual(AnomixRollupContract.escapeSlots),
      Bool,
      Bool(true),
      operatorSign.verify(operatorAddress, signMessage)
    ).assertTrue(
      'The operator signature is invalid when the current slot is not in the escape period'
    );

    const entryDepositRoot = this.entryContract.getDepositRoot();

    Provable.if(
      output.depositCount.greaterThan(0),
      output.depositRoot.equals(entryDepositRoot),
      Bool(true)
    ).assertTrue('depositRoot is not equal to entry contract depositRoot');

    const state = this.state.getAndAssertEquals();
    Provable.equal(
      RollupState,
      state,
      output.stateTransition.source
    ).assertTrue('stateTransition.source is not equal to current state');
    this.state.set(output.stateTransition.target);

    // Pay block tx fee to tx fee receiver(mina)
    this.send({ to: output.txFeeReceiver, amount: output.totalTxFees[0].fee });

    let currentBlockNumber = this.blockNumber.getAndAssertEquals();
    this.blockNumber.set(currentBlockNumber.add(1));
    this.emitEvent(
      'blockEvent',
      new RollupBlockEvent({
        blockNumber: currentBlockNumber,
        blockHash: output.blockHash,
        rollupSize: output.rollupSize,
        stateTransition: output.stateTransition,
        depositRoot: output.depositRoot,
        depositCount: output.depositCount,
        totalTxFees: output.totalTxFees,
        txFeeReceiver: output.txFeeReceiver,
      })
    );
    Provable.log('anomix rollup success');
  }

  @method updateOperatorAddress(
    newOperatorAddress: PublicKey,
    oldOperatorSign: Signature
  ) {
    const currentOperatorAddress = this.operatorAddress.getAndAssertEquals();
    oldOperatorSign
      .verify(currentOperatorAddress, newOperatorAddress.toFields())
      .assertTrue('The old operator signature is invalid');
    this.operatorAddress.set(newOperatorAddress);
  }

  @method updateVerificationKey(
    verificationKey: VerificationKey,
    operatorSign: Signature
  ) {
    const currentOperatorAddress = this.operatorAddress.getAndAssertEquals();
    operatorSign
      .verify(currentOperatorAddress, [verificationKey.hash])
      .assertTrue('The operator signature is invalid');
    this.account.verificationKey.set(verificationKey);
  }
}
