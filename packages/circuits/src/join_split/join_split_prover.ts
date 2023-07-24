import { DATA_TREE_HEIGHT } from '../constant';
import { AccountNote } from '../models/account';
import {
  AccountOperationType,
  AccountRequired,
  ActionType,
  AssetId,
  DUMMY_FIELD,
  NoteType,
} from '../models/constant';
import {
  calculateNoteNullifier,
  checkMembership,
  checkMembershipAndAssert,
} from '../utils/utils';
import {
  Bool,
  Experimental,
  Field,
  Poseidon,
  Provable,
  PublicKey,
  UInt64,
} from 'snarkyjs';
import {
  JoinSplitAccountInput,
  JoinSplitDepositInput,
  JoinSplitOutput,
  JoinSplitSendInput,
} from './models';

export { JoinSplitProver, JoinSplitProof };

let JoinSplitProver = Experimental.ZkProgram({
  publicOutput: JoinSplitOutput,

  methods: {
    dummy: {
      privateInputs: [],
      method() {
        return JoinSplitOutput.zero();
      },
    },
    deposit: {
      privateInputs: [JoinSplitDepositInput],

      method(depositInput: JoinSplitDepositInput) {
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
      },
    },

    send: {
      privateInputs: [JoinSplitSendInput],

      method(sendInput: JoinSplitSendInput) {
        const actionType = sendInput.actionType;

        const actionTypeIsSend = actionType.equals(ActionType.SEND);
        const actionTypeIsWithdraw = actionType.equals(ActionType.WITHDRAW);
        actionTypeIsSend
          .or(actionTypeIsWithdraw)
          .assertTrue('Invalid actionType');
        const publicAssetId = sendInput.assetId;

        Provable.if(
          actionTypeIsWithdraw,
          Bool,
          publicAssetId.equals(AssetId.MINA),
          publicAssetId.equals(DUMMY_FIELD)
        ).assertTrue('Invalid assetId');

        const publicValue = sendInput.publicValue;
        const publicOwner = sendInput.publicOwner;
        const inputNote1 = sendInput.inputNote1;
        const inputNote2 = sendInput.inputNote2;
        const outputNote1 = sendInput.outputNote1;
        const outputNote2 = sendInput.outputNote2;

        outputNote1.accountRequired
          .greaterThanOrEqual(0)
          .assertTrue('Invalid outputNote1 accountRequired');
        outputNote1.accountRequired
          .lessThan(3)
          .assertTrue('Invalid outputNote1 accountRequired');
        outputNote2.accountRequired
          .greaterThanOrEqual(0)
          .assertTrue('Invalid outputNote2 accountRequired');
        outputNote2.accountRequired
          .lessThan(3)
          .assertTrue('Invalid outputNote2 accountRequired');

        // TODO no check account membership

        inputNote1.noteType.assertEquals(NoteType.NORMAL);
        inputNote2.noteType.assertEquals(NoteType.NORMAL);

        const isPublicOwnerEmpty = publicOwner.isEmpty();

        sendInput.assetId.assertEquals(inputNote1.assetId);
        sendInput.assetId.assertEquals(outputNote1.assetId);
        Provable.if(
          outputNote2.value.equals(UInt64.zero),
          Bool,
          outputNote2.assetId.equals(DUMMY_FIELD),
          outputNote2.assetId.equals(sendInput.assetId)
        ).assertTrue('Invalid outputNote2 assetId');

        const [checkNoteType, checkPublicValue, checkPublicOwner] = Provable.if(
          actionTypeIsWithdraw,
          Provable.Array(Bool, 3),
          [
            outputNote1.noteType
              .equals(NoteType.WITHDRAWAL)
              .and(outputNote2.noteType.equals(NoteType.NORMAL)),
            publicValue.greaterThan(UInt64.zero),
            isPublicOwnerEmpty.not(),
          ],
          [
            outputNote1.noteType
              .equals(NoteType.NORMAL)
              .and(outputNote2.noteType.equals(NoteType.NORMAL)),
            publicValue.equals(UInt64.zero),
            isPublicOwnerEmpty,
          ]
        );
        checkNoteType.assertTrue('Invalid outputNote noteType');
        checkPublicValue.assertTrue('Invalid publicValue');
        checkPublicOwner.assertTrue('Invalid publicOwner');

        const maxIndex = 2 ** DATA_TREE_HEIGHT;
        sendInput.inputNote1Index.assertLessThan(
          maxIndex,
          'inputNote1Index is greater than maxIndex'
        );
        sendInput.inputNote2Index.assertLessThan(
          maxIndex,
          'inputNote2Index is greater than maxIndex'
        );
        sendInput.accountNoteIndex.assertLessThan(
          maxIndex,
          'accountNoteIndex is greater than maxIndex'
        );

        sendInput.accountRequired.assertLessThan(
          3,
          'accountRequired is greater than 2'
        );
        sendInput.inputNotesNum.assertGreaterThanOrEqual(
          1,
          'inputNotesNum < 1'
        );
        sendInput.inputNotesNum.assertLessThanOrEqual(2, 'inputNotesNum > 2');

        const inputNote1Commitment = inputNote1.commitment();
        const inputNote2Commitment = inputNote2.commitment();
        const outputNote1Commitment = outputNote1.commitment();
        const outputNote2Commitment = Provable.if(
          outputNote2.value.equals(UInt64.zero),
          Field,
          outputNote2.commitment(),
          DUMMY_FIELD
        );

        inputNote1Commitment.assertNotEquals(inputNote2Commitment);

        const accountPk = sendInput.accountPrivateKey.toPublicKey();
        const signerPk = Provable.if(
          sendInput.accountRequired.equals(AccountRequired.REQUIRED),
          PublicKey,
          sendInput.signingPk,
          accountPk
        );
        const accountNote = new AccountNote({
          aliasHash: sendInput.aliasHash,
          acctPk: accountPk,
          signingPk: signerPk,
        });
        const accountNoteCommitment = accountNote.commitment();

        accountPk.assertEquals(inputNote1.ownerPk);
        //accountPk.assertEquals(inputNote2.ownerPk);

        const inputNoteNumIs2 = sendInput.inputNotesNum.equals(2);
        sendInput.accountRequired.assertEquals(inputNote1.accountRequired);
        const [assetIdMatch, accountRequiredMatch, inputNote2OwnerMatch] =
          Provable.if(
            inputNoteNumIs2,
            Provable.Array(Bool, 3),
            [
              inputNote1.assetId.equals(inputNote2.assetId),
              inputNote1.accountRequired.equals(inputNote2.accountRequired),
              accountPk.equals(inputNote2.ownerPk),
            ],
            [Bool(true), Bool(true), Bool(true)]
          );
        assetIdMatch.assertTrue(
          'The assetId of inputNote1 and inputNote2 does not match'
        );
        accountRequiredMatch.assertTrue(
          'The accountRequired of inputNote1 and inputNote2 does not match'
        );
        inputNote2OwnerMatch.assertTrue(
          'The ownerPk of inputNote2 does not match'
        );

        Provable.if(
          outputNote1.creatorPk.isEmpty(),
          Bool,
          Bool(true),
          accountPk.equals(outputNote1.creatorPk)
        ).assertTrue('The creatorPk of outputNote1 does not match');

        Provable.if(
          outputNote2.creatorPk.isEmpty(),
          Bool,
          Bool(true),
          accountPk.equals(outputNote2.creatorPk)
        ).assertTrue('The creatorPk of outputNote2 does not match');

        const totalInValue = inputNote1.value.add(inputNote2.value);
        const totalOutValue = outputNote1.value.add(outputNote2.value);

        totalInValue.assertGreaterThan(
          totalOutValue,
          'totalInValue is less than or equal totalOutValue'
        );
        const txFee = totalInValue.sub(totalOutValue);

        const inputNote1InUse = sendInput.inputNotesNum.greaterThanOrEqual(1);
        const inputNote2InUse = inputNoteNumIs2;

        Provable.if(
          inputNote1InUse,
          Bool,
          checkMembership(
            inputNote1Commitment,
            sendInput.inputNote1Index,
            sendInput.inputNote1Witness,
            sendInput.dataRoot
          ),
          inputNote1.value.equals(UInt64.zero)
        ).assertTrue(
          'InputNote1 commitment check membership failed or inputNote1 value is not 0'
        );

        Provable.if(
          inputNote2InUse,
          Bool,
          checkMembership(
            inputNote2Commitment,
            sendInput.inputNote2Index,
            sendInput.inputNote2Witness,
            sendInput.dataRoot
          ),
          inputNote2.value.equals(UInt64.zero)
        ).assertTrue(
          'InputNote2 commitment check membership failed or inputNote2 value is not 0'
        );

        const nullifier1 = calculateNoteNullifier(
          inputNote1Commitment,
          sendInput.accountPrivateKey,
          inputNote1InUse
        );
        const nullifier2 = Provable.if(
          inputNote2InUse,
          Field,
          calculateNoteNullifier(
            inputNote2Commitment,
            sendInput.accountPrivateKey,
            inputNote2InUse
          ),
          DUMMY_FIELD
        );

        outputNote1.inputNullifier.assertEquals(nullifier1);
        outputNote2.inputNullifier.assertEquals(nullifier2);

        // verify account membership
        checkMembershipAndAssert(
          accountNoteCommitment,
          sendInput.accountNoteIndex,
          sendInput.accountNoteWitness,
          sendInput.dataRoot,
          'AccountNote commitment check membership failed'
        );

        const message = [
          outputNote1Commitment,
          outputNote2Commitment,
          nullifier1,
          nullifier2,
          publicAssetId,
          ...publicValue.toFields(),
          ...publicOwner.toFields(),
        ];

        sendInput.signature.verify(signerPk, message).assertTrue('Invalid sig');

        return new JoinSplitOutput({
          actionType,
          outputNoteCommitment1: outputNote1Commitment,
          outputNoteCommitment2: outputNote2Commitment,
          nullifier1,
          nullifier2,
          publicValue,
          publicOwner,
          publicAssetId,
          dataRoot: sendInput.dataRoot,
          txFee,
          txFeeAssetId: publicAssetId,
          depositRoot: DUMMY_FIELD,
          depositIndex: DUMMY_FIELD,
          //handledDepositIndex: DUMMY_FIELD,
        });
      },
    },

    operateAccount: {
      privateInputs: [JoinSplitAccountInput],

      method(input: JoinSplitAccountInput) {
        const operationType = input.operationType;
        operationType.assertLessThan(4, 'operationType is greater than 3');

        input.newAccountPk
          .equals(input.newSigningPk1)
          .not()
          .assertTrue('newAccountPk is equal to newSigningPk1');
        input.newAccountPk
          .equals(input.newSigningPk2)
          .not()
          .assertTrue('newAccountPk is equal to newSigningPk2');

        const operationTypeIsCreate = operationType.equals(
          AccountOperationType.CREATE
        );
        const operationTypeIsMigrate = operationType.equals(
          AccountOperationType.MIGRATE
        );
        Provable.if(
          operationTypeIsMigrate.not(),
          Bool,
          input.accountPk.equals(input.newAccountPk),
          Bool(true)
        ).assertTrue('accountPk is not equal to newAccountPk');

        const nullifier1 = Provable.if(
          operationTypeIsCreate,
          Field,
          Poseidon.hash([input.aliasHash]),
          DUMMY_FIELD
        );
        const nullifier2 = Provable.if(
          operationTypeIsCreate.or(operationTypeIsMigrate),
          Field,
          Poseidon.hash(input.newAccountPk.toFields()),
          DUMMY_FIELD
        );

        let signer = input.signingPk;
        const accountNote = new AccountNote({
          aliasHash: input.aliasHash,
          acctPk: input.accountPk,
          signingPk: signer,
        });
        const accountNoteCommitment = accountNote.commitment();

        const outputNote1 = new AccountNote({
          aliasHash: input.aliasHash,
          acctPk: input.newAccountPk,
          signingPk: input.newSigningPk1,
        });
        const outputNoteCommitment1 = outputNote1.commitment();
        const outputNote2 = new AccountNote({
          aliasHash: input.aliasHash,
          acctPk: input.newAccountPk,
          signingPk: input.newSigningPk2,
        });
        const outputNoteCommitment2 = outputNote2.commitment();

        const message = [
          input.aliasHash,
          ...input.accountPk.toFields(),
          ...input.newAccountPk.toFields(),
          ...input.newSigningPk1.toFields(),
          ...input.newSigningPk2.toFields(),
          nullifier1,
          nullifier2,
        ];

        input.signature.verify(signer, message).assertTrue('Invalid sig');

        Provable.if(
          operationTypeIsCreate.not(),
          Bool,
          checkMembership(
            accountNoteCommitment,
            input.accountNoteIndex,
            input.accountNoteWitness,
            input.dataRoot
          ),
          Bool(true)
        ).assertTrue('AccountNote commitment check membership failed');

        return new JoinSplitOutput({
          actionType: ActionType.ACCOUNT,
          outputNoteCommitment1,
          outputNoteCommitment2,
          nullifier1,
          nullifier2,
          publicValue: UInt64.zero,
          publicOwner: PublicKey.empty(),
          publicAssetId: DUMMY_FIELD,
          dataRoot: input.dataRoot,
          txFee: UInt64.zero,
          txFeeAssetId: AssetId.MINA,
          depositRoot: DUMMY_FIELD,
          depositIndex: DUMMY_FIELD,
          //handledDepositIndex: DUMMY_FIELD,
        });
      },
    },
  },
});

class JoinSplitProof extends Experimental.ZkProgram.Proof(JoinSplitProver) {}
