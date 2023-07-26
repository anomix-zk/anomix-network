import { InnerRollupProof } from '../inner_rollup/inner_rollup_prover';
import { Experimental } from 'snarkyjs';
import { BlockProveInput, BlockProveOutput } from './models';
import { checkMembershipAndAssert } from '../utils/utils';
import { DUMMY_FIELD } from '../models/constants';
import { RollupState, RollupStateTransition } from '../rollup_contract/models';

export { BlockProver, RollupProof };

let BlockProver = Experimental.ZkProgram({
  publicOutput: BlockProveOutput,

  methods: {
    prove: {
      privateInputs: [BlockProveInput, InnerRollupProof],
      method(input: BlockProveInput, rollupProof: InnerRollupProof) {
        rollupProof.verify();

        const rollupOutput = rollupProof.publicOutput;

        input.depositRoot.assertEquals(
          rollupOutput.depositRoot,
          'depositRoot should match'
        );

        input.txFeeReceiver
          .isEmpty()
          .assertFalse('txFeeReceiver should not be empty');

        input.oldDataRootsRoot.assertEquals(
          rollupOutput.dataRootsRoot,
          'dataRootsRoot should match'
        );

        // check index and witness of old data roots root
        checkMembershipAndAssert(
          DUMMY_FIELD,
          input.rootStartIndex,
          input.oldRootWitness,
          input.oldDataRootsRoot,
          'rootStartIndex and oldRootWitness should be valid'
        );

        // use index and witness to update data roots root
        const newDataRootsRoot = input.oldRootWitness.calculateRoot(
          rollupOutput.newDataRoot,
          input.rootStartIndex
        );

        let output = new BlockProveOutput({
          blockHash: DUMMY_FIELD,
          rollupSize: rollupOutput.rollupSize,
          stateTransition: new RollupStateTransition({
            source: new RollupState({
              dataRoot: rollupOutput.oldDataRoot,
              nullifierRoot: rollupOutput.oldNullRoot,
              dataRootsRoot: input.oldDataRootsRoot,
              depositStartIndex: rollupOutput.oldDepositStartIndex,
            }),
            target: new RollupState({
              dataRoot: rollupOutput.newDataRoot,
              nullifierRoot: rollupOutput.newNullRoot,
              dataRootsRoot: newDataRootsRoot,
              depositStartIndex: rollupOutput.newDepositStartIndex,
            }),
          }),
          depositRoot: rollupOutput.depositRoot,
          depositCount: rollupOutput.depositCount,
          totalTxFees: rollupOutput.totalTxFees,
          txFeeReceiver: input.txFeeReceiver,
        });
        const blockHash = output.generateBlockHash();
        output.blockHash = blockHash;

        return output;
      },
    },
  },
});

class RollupProof extends Experimental.ZkProgram.Proof(BlockProver) {}
