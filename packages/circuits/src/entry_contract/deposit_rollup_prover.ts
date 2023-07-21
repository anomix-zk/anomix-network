import { INITIAL_LEAF } from '@anomix/merkle-tree';
import {
  AccountUpdate,
  Empty,
  Experimental,
  Provable,
  SelfProof,
} from 'snarkyjs';
import {
  DepositActionBatch,
  DepositRollupState,
  DepositRollupStateTransition,
} from './models';
import { checkMembershipAndAssert } from '../utils/utils';

let DepositRollupProver = Experimental.ZkProgram({
  publicOutput: DepositRollupStateTransition,

  methods: {
    commitActionBatch: {
      privateInputs: [DepositRollupState, DepositActionBatch],

      method(state: DepositRollupState, actionBatch: DepositActionBatch) {
        let currDepositTreeRoot = state.depositTreeRoot;
        let currHandledActionsNum = state.handledActionsNum;
        let currActionsHash = state.currentActionsHash;

        // Process each action in the batch
        for (let i = 0, len = DepositActionBatch.batchSize; i < len; i++) {
          const currAction = actionBatch.actions[i];
          const currWitness = actionBatch.merkleWitnesses[i];
          const isDummyData = currAction.equals(0);

          // calculate new actions hash
          let eventHash = AccountUpdate.Actions.hash([currAction.toFields()]);
          currActionsHash = Provable.if(
            isDummyData,
            currActionsHash,
            AccountUpdate.Actions.updateSequenceState(
              currActionsHash,
              eventHash
            )
          );

          currHandledActionsNum = Provable.if(
            isDummyData,
            currHandledActionsNum,
            currHandledActionsNum.add(1)
          );
          Provable.log('currHandledActionsNum: ', currHandledActionsNum);
          // check leaf is exist
          checkMembershipAndAssert(
            INITIAL_LEAF,
            currHandledActionsNum,
            currWitness,
            currDepositTreeRoot,
            'leaf is already exist'
          );
          // calculate new deposit tree root
          currDepositTreeRoot = currWitness.calculateRoot(
            currAction,
            currHandledActionsNum
          );
        }

        return new DepositRollupStateTransition({
          source: state,
          target: new DepositRollupState({
            depositTreeRoot: currDepositTreeRoot,
            handledActionsNum: currHandledActionsNum,
            currentActionsHash: currActionsHash,
          }),
        });
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        p1: SelfProof<Empty, DepositRollupStateTransition>,
        p2: SelfProof<Empty, DepositRollupStateTransition>
      ) {
        p1.verify();
        p2.verify();

        p1.publicOutput.target.assertEquals(p2.publicOutput.source);

        return new DepositRollupStateTransition({
          source: p1.publicOutput.source,
          target: p2.publicOutput.target,
        });
      },
    },
  },
});

export class DepositRollupProof extends Experimental.ZkProgram.Proof(
  DepositRollupProver
) {}
