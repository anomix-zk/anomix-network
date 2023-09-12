import { INITIAL_LEAF } from '@anomix/merkle-tree';
import {
    AccountUpdate,
    Empty,
    Experimental,
    Provable,
    SelfProof,
    Field,
    Struct,
    Bool
} from 'snarkyjs';
import {
    DepositActionBatch,
    DepositRollupState,
    DepositRollupStateTransition,
} from '@anomix/circuits';
import { checkMembership } from '@anomix/circuits';

class TempParams extends Struct({
    isActionNonExist: Bool,
    depositRoot: Field,
    currentIndex: Field,
}) { }
// for test before circuit
export const commitActionBatch = (state: DepositRollupState, actionBatch: DepositActionBatch) => {
    let currDepositTreeRoot = state.depositRoot;
    let currIndex = state.currentIndex;
    let currActionsHash = state.currentActionsHash;

    Provable.log('0currDepositTreeRoot: ', currDepositTreeRoot);
    Provable.log('0currActionsHash: ', currActionsHash);

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

        // check non-membership
        const isNonExist = checkMembership(
            INITIAL_LEAF,
            currIndex,
            currWitness,
            currDepositTreeRoot
        );

        let temp = Provable.if(
            isDummyData,
            TempParams,
            new TempParams({
                isActionNonExist: Bool(true),
                depositRoot: currDepositTreeRoot,
                currentIndex: currIndex,
            }),
            new TempParams({
                isActionNonExist: isNonExist,
                depositRoot: currWitness.calculateRoot(currAction, currIndex),
                currentIndex: currIndex.add(1),
            })
        );

        temp.isActionNonExist.assertTrue(
            'action is already exist in current index'
        );
        currDepositTreeRoot = temp.depositRoot;
        currIndex = temp.currentIndex;

        Provable.log('   currDepositTreeRoot: ', currDepositTreeRoot);
        Provable.log('   currActionsHash: ', currActionsHash);

        Provable.log('   currIndex: ', currIndex);
    }

    Provable.log('1currDepositTreeRoot: ', currDepositTreeRoot);
    Provable.log('1currActionsHash: ', currActionsHash);

    const x = new DepositRollupStateTransition({
        source: state,
        target: new DepositRollupState({
            depositRoot: currDepositTreeRoot,
            currentIndex: currIndex,
            currentActionsHash: currActionsHash,
        }),
    });

    Provable.log('x: ', x);

    return x;
}

export const merge = (
    p1: SelfProof<Empty, DepositRollupStateTransition>,
    p2: SelfProof<Empty, DepositRollupStateTransition>
) => {
    p1.verify();
    p2.verify();

    p1.publicOutput.target.assertEquals(p2.publicOutput.source);

    return new DepositRollupStateTransition({
        source: p1.publicOutput.source,
        target: p2.publicOutput.target,
    });
}
