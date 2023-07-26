import { FEE_ASSET_ID_SUPPORT_NUM } from '../constants';
import {
  Bool,
  Empty,
  Experimental,
  Field,
  Provable,
  SelfProof,
} from 'snarkyjs';
import {
  DataRootWitnessData,
  InnerRollupInput,
  InnerRollupOutput,
  TxFee,
} from './models';
import { JoinSplitProof } from '../join_split/join_split_prover';
import { ActionType, AssetId, DUMMY_FIELD } from '../models/constants';
import { checkMembershipAndAssert } from '../utils/utils';
import {
  DataMerkleWitness,
  LowLeafWitnessData,
  NullifierMerkleWitness,
} from '../models/merkle_witness';

export { InnerRollupProver, InnerRollupProof };

let InnerRollupProver = Experimental.ZkProgram({
  publicOutput: InnerRollupOutput,

  methods: {
    proveTxBatch: {
      privateInputs: [InnerRollupInput, JoinSplitProof, JoinSplitProof],
      method(
        input: InnerRollupInput,
        txProof1: JoinSplitProof,
        txProof2: JoinSplitProof
      ) {
        const dataStartIndex = input.dataStartIndex;
        const nullStartIndex = input.nullStartIndex;
        const oldDataRoot = input.oldDataRoot;
        const oldNullRoot = input.oldNullRoot;
        const depositRoot = input.depositRoot;
        const tx1OldDataWitness1 = input.tx1OldDataWitness1;
        const tx1OldDataWitness2 = input.tx1OldDataWitness2;
        const tx2OldDataWitness1 = input.tx2OldDataWitness1;
        const tx2OldDataWitness2 = input.tx2OldDataWitness2;
        const dataRootsRoot = input.dataRootsRoot;
        const tx1RootWitnessData = input.tx1RootWitnessData;
        const tx2RootWitnessData = input.tx2RootWitnessData;
        const tx1LowLeafWitness1 = input.tx1LowLeafWitness1;
        const tx1LowLeafWitness2 = input.tx1LowLeafWitness2;
        const tx2LowLeafWitness1 = input.tx2LowLeafWitness1;
        const tx2LowLeafWitness2 = input.tx2LowLeafWitness2;
        const tx1OldNullWitness1 = input.tx1OldNullWitness1;
        const tx1OldNullWitness2 = input.tx1OldNullWitness2;
        const tx2OldNullWitness1 = input.tx2OldNullWitness1;
        const tx2OldNullWitness2 = input.tx2OldNullWitness2;
        const totalTxFees: TxFee[] = Array(FEE_ASSET_ID_SUPPORT_NUM).fill(
          TxFee.zero()
        );
        totalTxFees[0].assetId = AssetId.MINA;

        const txOutput1 = txProof1.publicOutput;
        const tx1IsDeposit = txOutput1.actionType.equals(ActionType.DEPOSIT);
        const txOutput2 = txProof2.publicOutput;
        const tx2IsDeposit = txOutput2.actionType.equals(ActionType.DEPOSIT);

        let currentDataRoot = oldDataRoot;
        let currentDataIndex = dataStartIndex;
        let currentNullRoot = oldNullRoot;
        let currentNullIndex = nullStartIndex;
        let currentDepositStartIndex = input.oldDepositStartIndex;
        let currentDepositCount = Field(0);

        depositRoot.assertNotEquals(DUMMY_FIELD, 'Deposit root is illegal');
        let firstDepositIndex = DUMMY_FIELD;
        Provable.if(
          tx1IsDeposit.and(tx2IsDeposit),
          Bool,
          txOutput2.depositIndex.equals(txOutput1.depositIndex.add(1)),
          Bool(true)
        ).assertTrue('Deposit index should be consecutive');
        // find first deposit index if exists deposit tx
        firstDepositIndex = Provable.if(
          firstDepositIndex.equals(DUMMY_FIELD).and(tx1IsDeposit),
          Field,
          txOutput1.depositIndex,
          firstDepositIndex
        );
        firstDepositIndex = Provable.if(
          firstDepositIndex.equals(DUMMY_FIELD).and(tx2IsDeposit),
          Field,
          txOutput2.depositIndex,
          firstDepositIndex
        );
        firstDepositIndex.assertEquals(
          currentDepositStartIndex,
          'First deposit index should be equal to current deposit start index'
        );

        let currentRollupSize = Field(0);
        // process tx1
        let {
          currentDataRoot: currentDataRoot1,
          currentDataIndex: currentDataIndex1,
          currentNullRoot: currentNullRoot1,
          currentNullIndex: currentNullIndex1,
          currentDepositStartIndex: currentDepositStartIndex1,
          currentRollupSize: currentRollupSize1,
          txFee: txFee1,
          currentDepositCount: currentDepositCount1,
        } = processTx({
          txProof: txProof1,
          depositRoot,
          currentDepositStartIndex,
          txFee: totalTxFees[0],
          rootWitnessData: tx1RootWitnessData,
          dataRootsRoot,
          currentDataRoot,
          currentDataIndex,
          oldDataWitness1: tx1OldDataWitness1,
          oldDataWitness2: tx1OldDataWitness2,
          lowLeafWitness1: tx1LowLeafWitness1,
          lowLeafWitness2: tx1LowLeafWitness2,
          currentNullRoot,
          currentNullIndex,
          oldNullWitness1: tx1OldNullWitness1,
          oldNullWitness2: tx1OldNullWitness2,
          currentRollupSize,
          currentDepositCount,
        });

        // process tx2
        let {
          currentDataRoot: currentDataRoot2,
          // currentDataIndex: currentDataIndex2,
          currentNullRoot: currentNullRoot2,
          // currentNullIndex: currentNullIndex2,
          currentDepositStartIndex: currentDepositStartIndex2,
          currentRollupSize: currentRollupSize2,
          txFee: txFee2,
          currentDepositCount: currentDepositCount2,
        } = processTx({
          txProof: txProof2,
          depositRoot,
          currentDepositStartIndex: currentDepositStartIndex1,
          txFee: txFee1,
          rootWitnessData: tx2RootWitnessData,
          dataRootsRoot,
          currentDataRoot: currentDataRoot1,
          currentDataIndex: currentDataIndex1,
          oldDataWitness1: tx2OldDataWitness1,
          oldDataWitness2: tx2OldDataWitness2,
          lowLeafWitness1: tx2LowLeafWitness1,
          lowLeafWitness2: tx2LowLeafWitness2,
          currentNullRoot: currentNullRoot1,
          currentNullIndex: currentNullIndex1,
          oldNullWitness1: tx2OldNullWitness1,
          oldNullWitness2: tx2OldNullWitness2,
          currentRollupSize: currentRollupSize1,
          currentDepositCount: currentDepositCount1,
        });

        totalTxFees[0] = txFee2;

        let output = new InnerRollupOutput({
          rollupId: DUMMY_FIELD,
          rollupSize: currentRollupSize2,
          oldDataRoot: oldDataRoot,
          newDataRoot: currentDataRoot2,
          oldNullRoot: oldNullRoot,
          newNullRoot: currentNullRoot2,
          dataRootsRoot: dataRootsRoot,
          totalTxFees: totalTxFees,
          depositRoot: depositRoot,
          depositCount: currentDepositCount2,
          oldDepositStartIndex: input.oldDepositStartIndex,
          newDepositStartIndex: currentDepositStartIndex2,
        });

        const rollupId = output.generateRollupId();
        output.rollupId = rollupId;
        return output;
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],
      method(
        p1: SelfProof<Empty, InnerRollupOutput>,
        p2: SelfProof<Empty, InnerRollupOutput>
      ) {
        p1.verify();
        p2.verify();

        const p1Output = p1.publicOutput;
        const p2Output = p2.publicOutput;

        p1Output.newDataRoot.assertEquals(
          p2Output.oldDataRoot,
          'p1 new data root unequal p2 old data root'
        );
        p1Output.newNullRoot.assertEquals(
          p2Output.oldNullRoot,
          'p1 new null root unequal p2 old null root'
        );
        p1Output.newDepositStartIndex.assertEquals(
          p2Output.oldDepositStartIndex,
          'p1 new deposit start index unequal p2 old deposit start index'
        );
        p1Output.dataRootsRoot.assertEquals(
          p2Output.dataRootsRoot,
          'p1 dataRootsRoot unequal p2 dataRootsRoot'
        );
        p1Output.depositRoot.assertEquals(
          p2Output.depositRoot,
          'p1 depositRoot unequal p2 depositRoot'
        );

        let totalTxFees = p1Output.totalTxFees;
        totalTxFees[0].fee = totalTxFees[0].fee.add(
          p2Output.totalTxFees[0].fee
        );

        let newRollupSize = p1Output.rollupSize.add(p2Output.rollupSize);

        let newOutput = new InnerRollupOutput({
          rollupId: DUMMY_FIELD,
          rollupSize: newRollupSize,
          oldDataRoot: p1Output.oldDataRoot,
          newDataRoot: p2Output.newDataRoot,
          oldNullRoot: p1Output.oldNullRoot,
          newNullRoot: p2Output.newNullRoot,
          dataRootsRoot: p1Output.dataRootsRoot,
          totalTxFees: totalTxFees,
          depositRoot: p1Output.depositRoot,
          depositCount: p1Output.depositCount.add(p2Output.depositCount),
          oldDepositStartIndex: p1Output.oldDepositStartIndex,
          newDepositStartIndex: p2Output.newDepositStartIndex,
        });
        const rollupId = newOutput.generateRollupId();
        newOutput.rollupId = rollupId;
        return newOutput;
      },
    },
  },
});

class InnerRollupProof extends Experimental.ZkProgram.Proof(
  InnerRollupProver
) {}

function processTx({
  txProof,
  depositRoot,
  currentDepositStartIndex,
  txFee,
  rootWitnessData,
  dataRootsRoot,
  currentDataRoot,
  currentDataIndex,
  oldDataWitness1,
  oldDataWitness2,
  lowLeafWitness1,
  lowLeafWitness2,
  currentNullRoot,
  currentNullIndex,
  oldNullWitness1,
  oldNullWitness2,
  currentRollupSize,
  currentDepositCount,
}: {
  txProof: JoinSplitProof;
  depositRoot: Field;
  currentDepositStartIndex: Field;
  txFee: TxFee;
  rootWitnessData: DataRootWitnessData;
  dataRootsRoot: Field;
  currentDataRoot: Field;
  currentDataIndex: Field;
  oldDataWitness1: DataMerkleWitness;
  oldDataWitness2: DataMerkleWitness;
  lowLeafWitness1: LowLeafWitnessData;
  lowLeafWitness2: LowLeafWitnessData;
  currentNullRoot: Field;
  currentNullIndex: Field;
  oldNullWitness1: NullifierMerkleWitness;
  oldNullWitness2: NullifierMerkleWitness;
  currentRollupSize: Field;
  currentDepositCount: Field;
}): {
  currentDataRoot: Field;
  currentDataIndex: Field;
  currentNullRoot: Field;
  currentNullIndex: Field;
  currentDepositStartIndex: Field;
  currentRollupSize: Field;
  txFee: TxFee;
  currentDepositCount: Field;
} {
  txProof.verify();
  const txOutput = txProof.publicOutput;
  const outputNoteCommitment1 = txOutput.outputNoteCommitment1;
  const outputNoteCommitment2 = txOutput.outputNoteCommitment2;
  const nullifier1 = txOutput.nullifier1;
  const nullifier2 = txOutput.nullifier2;
  const txIsDeposit = txOutput.actionType.equals(ActionType.DEPOSIT);

  currentRollupSize = Provable.if(
    txOutput.actionType.equals(ActionType.DUMMY),
    currentRollupSize,
    currentRollupSize.add(1)
  );

  Provable.if(
    txIsDeposit,
    Bool,
    txOutput.depositRoot.equals(depositRoot),
    Bool(true)
  ).assertTrue(
    'Tx deposit root should be equal to deposit root of private input'
  );
  txFee.fee.add(txOutput.txFee);

  const [depositStartIndex, depositCount] = Provable.if(
    txIsDeposit,
    Provable.Array(Field, 2),
    [currentDepositStartIndex.add(1), currentDepositCount.add(1)],
    [currentDepositStartIndex, currentDepositCount]
  );

  // check tx data root validity
  checkMembershipAndAssert(
    txOutput.dataRoot,
    rootWitnessData.dataRootIndex,
    rootWitnessData.witness,
    dataRootsRoot,
    'tx data root should be valid'
  );
  // check index and witness of outputNoteCommitment1
  checkMembershipAndAssert(
    DUMMY_FIELD,
    currentDataIndex,
    oldDataWitness1,
    currentDataRoot,
    'oldDataWitness1 illegal'
  );
  // use index, witness and new note commitment to update data root
  currentDataRoot = oldDataWitness1.calculateRoot(
    outputNoteCommitment1,
    currentDataIndex
  );
  currentDataIndex = currentDataIndex.add(1);

  // check index and witness of outputNoteCommitment2
  checkMembershipAndAssert(
    DUMMY_FIELD,
    currentDataIndex,
    oldDataWitness2,
    currentDataRoot,
    'oldDataWitness2 illegal'
  );
  // use index, witness and new note commitment to update data root
  currentDataRoot = oldDataWitness2.calculateRoot(
    outputNoteCommitment2,
    currentDataIndex
  );
  currentDataIndex = currentDataIndex.add(1);

  // check nullifier1 nonMembership
  lowLeafWitness1.checkMembershipAndAssert(
    currentNullRoot,
    'lowLeafWitness1 illegal'
  );
  const null1IsDummy = nullifier1.equals(DUMMY_FIELD);
  Provable.if(
    null1IsDummy,
    Bool,
    Bool(true),
    nullifier1.greaterThan(lowLeafWitness1.leafData.value)
  ).assertTrue('Nullifier1 should not exist in null tree');

  const lowLeafNextValue1 = lowLeafWitness1.leafData.nextValue;
  Provable.if(
    null1IsDummy.not().and(lowLeafNextValue1.equals(DUMMY_FIELD).not()),
    Bool,
    nullifier1.lessThan(lowLeafNextValue1),
    Bool(true)
  ).assertTrue('Nullifier1 should not exist in null tree');

  // check index and witness of nullifier1
  checkMembershipAndAssert(
    DUMMY_FIELD,
    currentNullIndex,
    oldNullWitness1,
    currentNullRoot,
    'oldNullWitness1 illegal'
  );
  // use index, witness and new nullifier to update null root
  currentNullRoot = oldNullWitness1.calculateRoot(nullifier1, currentNullIndex);
  currentNullIndex = currentNullIndex.add(1);

  // check nullifier2 nonMembership
  lowLeafWitness2.checkMembershipAndAssert(
    currentNullRoot,
    'LowLeafWitness2 illegal'
  );
  const null2IsDummy = nullifier2.equals(DUMMY_FIELD);
  Provable.if(
    null2IsDummy,
    Bool,
    Bool(true),
    nullifier2.greaterThan(lowLeafWitness2.leafData.value)
  ).assertTrue('Nullifier2 should not exist in null tree');

  const lowLeafNextValue2 = lowLeafWitness2.leafData.nextValue;
  Provable.if(
    null2IsDummy.not().and(lowLeafNextValue2.equals(DUMMY_FIELD).not()),
    Bool,
    nullifier2.lessThan(lowLeafNextValue2),
    Bool(true)
  ).assertTrue('Nullifier2 should not exist in null tree');

  // check index and witness of nullifier2
  checkMembershipAndAssert(
    DUMMY_FIELD,
    currentNullIndex,
    oldNullWitness2,
    currentNullRoot,
    'oldNullWitness2 illegal'
  );
  // use index, witness and new nullifier to update null root
  currentNullRoot = oldNullWitness2.calculateRoot(nullifier2, currentNullIndex);
  currentNullIndex = currentNullIndex.add(1);

  return {
    currentDataRoot,
    currentDataIndex,
    currentNullRoot,
    currentNullIndex,
    currentDepositStartIndex: depositStartIndex,
    currentRollupSize,
    txFee,
    currentDepositCount: depositCount,
  };
}
