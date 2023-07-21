import { RollupProof } from '../block_prover/block_prover';
import {
  DeployArgs,
  Field,
  method,
  Provable,
  PublicKey,
  SmartContract,
  State,
  state,
} from 'snarkyjs';
import { RollupState, RollupStateTransition } from './models';

export class AnomixRollupContract extends SmartContract {
  @state(RollupState) state = State<RollupState>();
  @state(Field) slot = State<Field>();
  @state(Field) escapeFactor = State<Field>();
  @state(PublicKey) sequencerAddress = State<PublicKey>();

  events = {
    stateTransition: RollupStateTransition,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
  }

  @method rollup(proof: RollupProof) {
    proof.verify();

    const state = this.state.getAndAssertEquals();
    Provable.assertEqual(
      RollupState,
      proof.publicOutput.stateTransition.source,
      state
    );

    this.state.set(proof.publicOutput.stateTransition.target);
    Provable.log('anomix rollup success');
  }
}
