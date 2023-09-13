
import {
    AccountOperationType,
    AccountRequired,
    ActionType,
    AssetId,
    DUMMY_FIELD,
    NoteType,
} from '@anomix/circuits';
import {
    calculateNoteNullifier,
    checkMembership,
    checkMembershipAndAssert,
} from '@anomix/circuits';
import {
    Bool,
    Experimental,
    Field,
    Poseidon,
    Provable,
    PublicKey,
    UInt64,
} from 'o1js';
import {
    JoinSplitAccountInput,
    JoinSplitDepositInput,
    JoinSplitOutput,
    JoinSplitSendInput,
} from '@anomix/circuits';

export const deposit = (depositInput: JoinSplitDepositInput) => {
    const actionType = ActionType.DEPOSIT;
    const nullifier1 = DUMMY_FIELD;
    const nullifier2 = DUMMY_FIELD;
    const outputNoteCommitment1 = depositInput.depositNoteCommitment;
    const outputNoteCommitment2 = DUMMY_FIELD;

    const zeroValue = UInt64.zero;
    const txFee = zeroValue;
    const txFeeAssetId = AssetId.MINA;

    depositInput.publicValue.assertGreaterThan(
        zeroValue,
        'publicValue is 0'
    );
    depositInput.publicAssetId.assertEquals(
        AssetId.MINA,
        'publicAssetId is not MINA'
    );

    // depositInput.handledDepositIndex.assertLessThanOrEqual(
    //   depositInput.depositNoteIndex,
    //   'handledDepositIndex is greater than depositNoteIndex'
    // );

    checkMembershipAndAssert(
        outputNoteCommitment1,
        depositInput.depositNoteIndex,
        depositInput.depositWitness,
        depositInput.depositRoot,
        'OutputNote1 commitment check membership failed'
    );

    return new JoinSplitOutput({
        actionType,
        outputNoteCommitment1,
        outputNoteCommitment2,
        nullifier1,
        nullifier2,
        publicValue: depositInput.publicValue,
        publicOwner: depositInput.publicOwner,
        publicAssetId: depositInput.publicAssetId,
        dataRoot: depositInput.dataRoot,
        txFee,
        txFeeAssetId,
        depositRoot: depositInput.depositRoot,
        depositIndex: depositInput.depositNoteIndex,
        //handledDepositIndex: depositInput.handledDepositIndex,
    });
}
