import {
  DeployArgs,
  Field,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt32,
} from 'snarkyjs';

export class AnomixEntryContract extends SmartContract {
  @state(Field) depositTreeRoot = State<Field>();
  @state(PublicKey) sequencerAddress = State<PublicKey>();
  @state(UInt32) handledActionsNum = State<UInt32>();
  @state(Field) actionsHash = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
  }
}
