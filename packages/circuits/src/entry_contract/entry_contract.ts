import {
  AccountUpdate,
  DeployArgs,
  Field,
  method,
  Provable,
  PublicKey,
  Reducer,
  SmartContract,
  Permissions,
  State,
  state,
  UInt64,
  VerificationKey,
  Signature,
  Poseidon,
} from 'snarkyjs';
import { DepositRollupProof } from './deposit_rollup_prover';
import { AccountRequired, AssetId, NoteType } from '../models/constants';
import {
  DepositEvent,
  DepositRollupState,
  DepositRollupStateTransition,
  EncryptedNoteFieldData,
} from './models';
import { ValueNote } from '../models/value_note';
import { DEPOSIT_TREE_INIT_ROOT, STANDARD_TREE_INIT_ROOT_20 } from '../constants';

export class AnomixEntryContract extends SmartContract {
  @state(DepositRollupState) depositState = State<DepositRollupState>();
  @state(PublicKey) rollupContractAddress = State<PublicKey>();

  reducer = Reducer({ actionType: Field });

  events = {
    deposit: DepositEvent,
    depositStateUpdate: DepositRollupStateTransition,
  };

  deployEntryContract(args: DeployArgs, rollupContractAddress: PublicKey) {
    super.deploy(args);
    this.rollupContractAddress.set(rollupContractAddress);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
      editActionState: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
    });
  }

  @method init() {
    super.init();

    const provedState = this.account.provedState.getAndAssertEquals();
    provedState.assertFalse('The entry contract has been initialized');

    this.depositState.set(
      new DepositRollupState({
        depositRoot: DEPOSIT_TREE_INIT_ROOT,
        handledActionsNum: Field(0),
        currentActionsHash: Reducer.initialActionState,
      })
    );
  }

  @method getDepositRoot(): Field {
    const depositState = this.depositState.getAndAssertEquals();
    return depositState.depositRoot;
  }

  @method deposit(
    payer: PublicKey,
    note: ValueNote,
    encryptedNoteData: EncryptedNoteFieldData
  ) {
    note.assetId.assertEquals(AssetId.MINA, 'assetId is not MINA');
    note.noteType.assertEquals(NoteType.NORMAL, 'noteType is not NORMAL');
    note.value.assertGreaterThan(UInt64.zero, 'note value is zero');
    note.ownerPk.isEmpty().assertFalse('The ownerPk of note is empty');
    note.accountRequired
      .equals(AccountRequired.REQUIRED)
      .or(note.accountRequired.equals(AccountRequired.NOTREQUIRED))
      .assertTrue('The accountRequired of note is not REQUIRED or NOTREQUIRED');
    note.inputNullifier.assertEquals(
      Poseidon.hash(payer.toFields()),
      'The inputNullifier of note is not equal to hash of payer address'
    );
    let rollupContractAddress = this.rollupContractAddress.getAndAssertEquals();
    let payerAccUpdate = AccountUpdate.createSigned(payer);
    payerAccUpdate.send({ to: rollupContractAddress, amount: note.value });

    const noteCommitment = note.commitment();

    this.emitEvent(
      'deposit',
      new DepositEvent({
        noteCommitment: noteCommitment,
        assetId: note.assetId,
        depositValue: note.value,
        sender: payer,
        encryptedNoteData,
      })
    );

    this.reducer.dispatch(noteCommitment);
  }

  @method updateDepositState(proof: DepositRollupProof) {
    proof.verify();

    this.account.actionState.assertEquals(
      proof.publicOutput.target.currentActionsHash
    );
    let state = this.depositState.getAndAssertEquals();
    proof.publicOutput.source.assertEquals(state);
    this.depositState.set(proof.publicOutput.target);
    this.emitEvent('depositStateUpdate', proof.publicOutput);
    Provable.log('update deposit state success');
  }

  @method updateVerificationKey(
    verificationKey: VerificationKey,
    operatorAddress: PublicKey,
    operatorSign: Signature
  ) {
    const rollupContractAddress =
      this.rollupContractAddress.getAndAssertEquals();

    // check operator address of rollup contract
    const operatorFields = operatorAddress.toFields();
    const accountUpdate = AccountUpdate.create(rollupContractAddress);
    AccountUpdate.assertEquals(
      accountUpdate.body.preconditions.account.state[5],
      operatorFields[0]
    );
    AccountUpdate.assertEquals(
      accountUpdate.body.preconditions.account.state[6],
      operatorFields[1]
    );

    operatorSign
      .verify(operatorAddress, [verificationKey.hash])
      .assertTrue('The operator signature is invalid');
    this.account.verificationKey.set(verificationKey);
  }
}
