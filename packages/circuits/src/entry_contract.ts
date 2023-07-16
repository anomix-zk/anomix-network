import {
  AccountUpdate,
  DeployArgs,
  Field,
  method,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt32,
} from 'snarkyjs';
import { ValueNote } from './models/value_note';

export class AnomixEntryContract extends SmartContract {
  @state(Field) depositTreeRoot = State<Field>();
  @state(PublicKey) sequencerAddress = State<PublicKey>();
  @state(UInt32) handledActionsNum = State<UInt32>();
  @state(Field) actionsHash = State<Field>();
  @state(PublicKey) layer2ContractAddress = State<PublicKey>();

  deploy(args: DeployArgs) {
    super.deploy(args);
  }

  @method deposit(payer: PublicKey, note: ValueNote) {
    let payerAccUpdate = AccountUpdate.createSigned(payer);
    payerAccUpdate.balance.subInPlace(note.value);
    this.balance.addInPlace(note.value);

    note.asset_id.assertEquals(UInt32.zero);

    const layer2ContractAddress =
      this.layer2ContractAddress.getAndAssertEquals();
    const layer2ContractAccount = AccountUpdate.create(layer2ContractAddress);
  }
}
