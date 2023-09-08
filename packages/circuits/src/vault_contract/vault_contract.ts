import {
  Bool,
  DeployArgs,
  Field,
  method,
  Provable,
  PublicKey,
  SmartContract,
  state,
  State,
  Permissions,
  VerificationKey,
  AccountUpdate,
  Experimental,
  UInt64,
  Struct,
} from 'snarkyjs';
import { MINA, USER_NULLIFIER_TREE_INIT_ROOT } from '../constants';
import { AssetId, DUMMY_FIELD, NoteType } from '../models/constants';
import {
  UserLowLeafWitnessData,
  UserNullifierMerkleWitness,
} from '../models/merkle_witness';
import { checkMembershipAndAssert } from '../utils/utils';
import { WithdrawFundEvent, WithdrawNoteWitnessData } from './models';

function updateNullifierRootAndNullStartIndex(
  nullifierRoot: Field,
  nullStartIndex: Field,
  nullifier: Field,
  lowLeafWitness: UserLowLeafWitnessData,
  oldNullWitness: UserNullifierMerkleWitness
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

export class UserState extends Struct({
  nullifierRoot: Field,
  nullStartIndex: Field,
}) {}

export class WithdrawAccount extends SmartContract {
  @state(UserState) userState = State<UserState>();

  @method getUserState(): UserState {
    const userState = this.userState.getAndAssertEquals();
    return userState;
  }

  @method updateState(nullifierRoot: Field, nullStartIndex: Field) {
    this.userState.set(new UserState({ nullifierRoot, nullStartIndex }));
    this.self.body.mayUseToken = AccountUpdate.MayUseToken.ParentsOwnToken;
  }
}

export class AnomixVaultContract extends SmartContract {
  static withdrawAccountVkHash: Field;

  @state(PublicKey) rollupContractAddress = State<PublicKey>();

  events = {
    withdrawFundEvent: WithdrawFundEvent,
  };

  deployVaultContract(args: DeployArgs, rollupContractAddress: PublicKey) {
    super.deploy(args);
    this.rollupContractAddress.set(rollupContractAddress);

    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
      editActionState: Permissions.proof(),
      send: Permissions.proof(),
      access: Permissions.proof(),
      //setVerificationKey: Permissions.proof(),
    });
  }

  public get withdrawAccountVkHash() {
    if (!AnomixVaultContract.withdrawAccountVkHash) {
      throw new Error('Anomix withdraw account vk hash unknown!');
    }
    return AnomixVaultContract.withdrawAccountVkHash;
  }

  // Note: only mina deposit
  // TODO: support other token deposit, set deposit permission and amount limit
  @method deposit(payerAddress: PublicKey, amount: UInt64) {
    let payerAccUpdate = AccountUpdate.createSigned(payerAddress);
    payerAccUpdate.balance.subInPlace(amount);
    this.balance.addInPlace(amount);
  }

  // TODO: add eploy account event
  @method deployAccount(
    verificationKey: VerificationKey,
    userAddress: PublicKey
  ) {
    verificationKey.hash.assertEquals(this.withdrawAccountVkHash, 'invalid vk');

    const tokenId = this.token.id;
    const deployUpdate = Experimental.createChildAccountUpdate(
      this.self,
      userAddress,
      tokenId
    );
    deployUpdate.account.isNew.assertEquals(Bool(true));
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

    AccountUpdate.setValue(
      deployUpdate.body.update.appState[0],
      USER_NULLIFIER_TREE_INIT_ROOT
    );
    AccountUpdate.setValue(deployUpdate.body.update.appState[1], Field(0));
    deployUpdate.requireSignature();
  }

  @method withdraw(
    withdrawNoteWitnessData: WithdrawNoteWitnessData,
    lowLeafWitness: UserLowLeafWitnessData,
    oldNullWitness: UserNullifierMerkleWitness,
    rollupDataRoot: Field
  ) {
    Provable.log('withdrawNoteWitnessData', withdrawNoteWitnessData);
    Provable.log('lowLeafWitness', lowLeafWitness);
    Provable.log('oldNullWitness', oldNullWitness);
    Provable.log('rollupDataRoot', rollupDataRoot);
    // check rollup data root
    const rollupContractAddress =
      this.rollupContractAddress.getAndAssertEquals();
    const accountUpdate = AccountUpdate.create(rollupContractAddress);
    AccountUpdate.assertEquals(
      accountUpdate.body.preconditions.account.state[0],
      rollupDataRoot
    );

    // check user mina account
    const withdrawNote = withdrawNoteWitnessData.withdrawNote;
    const userAddress = withdrawNote.ownerPk;
    userAddress.isEmpty().assertFalse('user address is empty');
    const userMinaAu = AccountUpdate.createSigned(userAddress);
    userMinaAu.account.isNew.assertEquals(Bool(false));

    // check withdraw note
    withdrawNote.assetId.assertEquals(
      AssetId.MINA,
      'invalid asset id of withdraw note'
    );
    withdrawNote.noteType.assertEquals(
      NoteType.WITHDRAWAL,
      'invalid note type'
    );
    withdrawNote.value.assertGreaterThan(UInt64.zero, 'invalid note value');

    // check commitment exists in data tree
    const commitment = withdrawNote.commitment();
    Provable.log('withdrawNote commitment: ', commitment);

    checkMembershipAndAssert(
      commitment,
      withdrawNoteWitnessData.index,
      withdrawNoteWitnessData.witness,
      rollupDataRoot,
      'withdrawNoteWitnessData illegal'
    );

    const tokenId = this.token.id;
    const userAccount = new WithdrawAccount(userAddress, tokenId);
    const userState = userAccount.getUserState();
    const userNulliferRoot = userState.nullifierRoot;
    Provable.log('userNulliferRoot', userNulliferRoot);
    const userNullStartIndex = userState.nullStartIndex;
    Provable.log('userNullStartIndex', userNullStartIndex);

    const { nullifierRoot, nullStartIndex } =
      updateNullifierRootAndNullStartIndex(
        userNulliferRoot,
        userNullStartIndex,
        commitment,
        lowLeafWitness,
        oldNullWitness
      );

    userAccount.updateState(nullifierRoot, nullStartIndex);
    this.approve(userAccount.self, AccountUpdate.Layout.AnyChildren);

    // withdraw note value(mina) to user
    this.send({ to: userMinaAu, amount: withdrawNote.value });

    this.emitEvent(
      'withdrawFundEvent',
      new WithdrawFundEvent({
        receiverAddress: userAddress,
        noteNullifier: commitment,
        nullifierIndex: nullStartIndex,
        receiverNulliferRootBefore: userNulliferRoot,
        receiverNulliferRootAfter: nullifierRoot,
        amount: withdrawNote.value,
        assetId: withdrawNote.assetId,
      })
    );
  }
}
