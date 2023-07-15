import { Field, UInt32, UInt64 } from 'snarkyjs';
import { L2Tx as CircuitL2Tx } from './l2_tx.js';
import { DataTreeMerklePath, NullifierTreeMerklePath, RootTreeMerklePath } from './leaf_merkle_path.js';

export class CommonUserTxWrapper {
    origin: CircuitL2Tx;

    dataTreeRoot_MerklePath: RootTreeMerklePath;

    dirtyMerkleWitness: {
        dirtyDataTreeRoot: Field;
        dirtyNullifierTreeRoot: Field;

        zeroDataLeafC_MerklePath: DataTreeMerklePath;

        nullifierA_NonExistMerklePath: NullifierTreeMerklePath;
        nullifierB_NonExistMerklePath: NullifierTreeMerklePath;
    };

    middleMerkelWitness: {
        // middleAPredecessorNullifierTreeRoot,
        zeroNullifierLeafA_MerklePath: NullifierTreeMerklePath;

        // middleANullifierTreeRoot,
        // nullifierA_predecessor_middle_MerklePath: NullifierTreeMerklePath; // TODO no need??

        nullifierB_predecessor_middle_MerklePath: NullifierTreeMerklePath;

        // middleCDataTreeRoot;
        zeroDataLeafD_middleMerklePath: DataTreeMerklePath;
    };

    resultingMerkleWitness: {
        // resultingBPredecessorNullifierTreeRoot,
        zeroNullifierLeafB_MerklePath: NullifierTreeMerklePath;

        resultingNullifierTreeRoot: Field;
        // nullifierB_predecessor_resulting_merkleWitness: `input_note_nullifier_B's predecessor's middle existence merkleWitness on nullifier tree`, // TODO no need??
        // nullifierA_resulting_merkleWitness: `input_note_nullifier_A's resulting existence merkleWitness on nullifier tree`, // TODO no need??

        resultingDataTreeRoot: Field;

        //commitmentC_resulting_merkleWitness: `output_note_commitment_C's resulting exisence merkleWitness on data tree`,      
    };

    static zeroCommonUserTxWrapper() {
        // TODO need improve here with data_tree_root & nullifier_tree_root
        // let l2_tx = CircuitL2Tx.zeroL2Tx();

        return new CommonUserTxWrapper();
    }
}

export class InnerRollupEntity {
    innerRollupId: Field;

    innerRollupSize: UInt32; // indicate the number of non-padding tx,

    rootTreeRoot0: Field;

    dataTreeRoot0: Field;
    nullifierTreeRoot0: Field;

    resultingDataRreeRoot: Field;
    resultingNullifierTreeRoot: Field;

    totalTxFee: [
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },

        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },

        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },

        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 }
    ]; // 需要优化，如固定数组为20个, assetId从0递增？

    txIds: [Field, Field, Field, Field, Field, Field, Field, Field]; //fixed number, [inner_rollup_count] TODO 为了让任何人按序重建merkle tree

    proof: any;
}
