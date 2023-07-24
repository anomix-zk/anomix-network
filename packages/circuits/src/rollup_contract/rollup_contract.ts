import { RollupProof } from '../block_prover/block_prover';
import {
  Bool,
  DeployArgs,
  Field,
  method,
  Provable,
  PublicKey,
  SmartContract,
  State,
  state,
} from 'snarkyjs';
import { RollupBlockEvent, RollupState } from './models';
import { AnomixEntryContract } from '../entry_contract/entry_contract';

export class AnomixRollupContract extends SmartContract {
  static entryContractAddress: PublicKey;

  @state(RollupState) state = State<RollupState>();
  @state(Field) blockNumber = State<Field>();
  @state(Field) escapeSlots = State<Field>();
  @state(PublicKey) sequencerAddress = State<PublicKey>();

  // events = {
  //   blockEvent: RollupBlockEvent,
  // };

  deploy(args: DeployArgs) {
    super.deploy(args);
  }

  public get entryContract() {
    if (!AnomixRollupContract.entryContractAddress) {
      throw new Error('Anomix entry contract address unknown!');
    }
    return new AnomixEntryContract(AnomixRollupContract.entryContractAddress);
  }

  @method updateRollupState(proof: RollupProof) {
    proof.verify();

    const output = proof.publicOutput;
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

    let currentBlockNumber = this.blockNumber.getAndAssertEquals();
    this.blockNumber.set(currentBlockNumber.add(1));
    // this.emitEvent(
    //   'blockEvent',
    //   new RollupBlockEvent({
    //     blockNumber: currentBlockNumber,
    //     blockInfo: proof.publicOutput,
    //   })
    // );
    Provable.log('anomix rollup success');
  }
}
