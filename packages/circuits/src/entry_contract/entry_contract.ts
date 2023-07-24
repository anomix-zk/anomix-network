import {
  AccountUpdate,
  DeployArgs,
  Field,
  method,
  Provable,
  PublicKey,
  Reducer,
  SmartContract,
  State,
  state,
} from 'snarkyjs';
import { DepositRollupProof } from './deposit_rollup_prover';
import { AssetId, NoteType } from '../models/constant';
import { DepositEvent, DepositRollupState } from './models';
import { ValueNote } from '../models/value_note';

export class AnomixEntryContract extends SmartContract {
  @state(DepositRollupState) depositState = State<DepositRollupState>();
  @state(PublicKey) rollupContractAddress = State<PublicKey>();
  @state(PublicKey) sequencerAddress = State<PublicKey>();

  reducer = Reducer({ actionType: Field });

  events = {
    deposit: DepositEvent,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
  }

  @method getDepositRoot(): Field {
    const depositState = this.depositState.getAndAssertEquals();
    return depositState.depositRoot;
  }

  @method deposit(payer: PublicKey, note: ValueNote) {
    let rollupContractAddress = this.rollupContractAddress.getAndAssertEquals();
    let payerAccUpdate = AccountUpdate.createSigned(payer);
    payerAccUpdate.send({ to: rollupContractAddress, amount: note.value });

    note.assetId.assertEquals(AssetId.MINA, 'assetId is not MINA');
    note.noteType.assertEquals(NoteType.NORMAL, 'noteType is not NORMAL');

    const noteCommitment = note.commitment();
    const encryptedNote = note.encrypt();
    this.emitEvent(
      'deposit',
      new DepositEvent({
        noteCommitment: noteCommitment,
        assetId: note.assetId,
        depositValue: note.value,
        sender: payer,
        encryptedNote: encryptedNote,
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
    Provable.log('deposit-circuit-rollup success');
  }
}
