
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { Tree } from "@anomix/types";
import { LeafData } from "@anomix/merkle-tree";
import { InnerRollupProof, JoinSplitOutput, JoinSplitProof } from "@anomix/circuits";
import { PrivateKey, Mina } from "snarkyjs";
import { MerkleTreeId, WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { FlowTaskType, FLowTask } from "./constant";

export class FlowScheduler {
    private processingTxList: JoinSplitProof[]
    private rollupMergeEntityList: InnerRollupProof[]
    private depositCommitmentSize: number
    // private depositActionList: JoinSplitDepositInput[]

    constructor(private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    private init() {
        // TODO clear dirty data on both rollupDB & worldStateDB
        this.worldStateDB.rollback();
        // rollupDB??
    }

    async start() {
        // clear dirty data on both rollupDB & worldStateDB at the beginning
        this.init();

        const innerRollupTxNum = config.innerRollup.txCount;
        const includeUnCommit = true;

        // TODO ask if 'Deposit-Processor' could stop
        let couldStopMarkDepositActions = true;
        //
        //
        if (couldStopMarkDepositActions) {
            // process deposit actions
            this.processDepositActions();
        }

        // query unhandled Non-Deposit tx list from RollupDB
        const txList = await this.rollupDB.queryPendingTxList();
        if (txList.length == 0 && !couldStopMarkDepositActions) {
            //  end this flow!
            this.worldState.reset();
            return;

        } else if (txList.length == 0 && couldStopMarkDepositActions) {
            // interrupt this flow! 
            return;
        }

        // ================== below: txList.length > 0 ==================

        // preinsert Non-Deposit txs
        // query all related merkle-proof and compose the CommonUserTxWrapper for each L2 tx 
        let commonUserTxWrapperList = await this.preInsertIntoTreeCache(includeUnCommit, txList);
        // TODO set to this.processingTxList
        //

        if (!couldStopMarkDepositActions) {// ask 'deposit-processor' again
            // couldStopDeposit = true;
            //
            //
            if (couldStopMarkDepositActions) {// if answer true
                // process deposit actions
                this.processDepositActions();
            }
        }

        if (!couldStopMarkDepositActions) {// still cannot stop, ignore the deposit ones at current block.
            // calc dummy tx
            let len = txList.length + this.depositCommitmentSize;
            let pendingTxSize = len % innerRollupTxNum;
            // fill dummy tx
            for (let index = 0; index < pendingTxSize; index++) {
                this.processingTxList.push(config.joinsplitProofDummyTx);
            }
        }

        if (this.processingTxList.length % 2 == 1) {// means couldStopMarkDepositActions == true
            // the last one need wait for DepositTxList Coming Back to join them
            //
            //
        }

        // send non-deposit ones [two by two] to proof-generator for 'InnerRollupProver.proveTxBatch()', and reduce the sent ones from processingTxList.
        // 
        //
        //
    }

    private async preInsertIntoTreeCache(includeUnCommit: boolean, txList: any[]) {
        const rootTreeRoot0 = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, includeUnCommit);
        const dataTreeRoot0 = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, includeUnCommit);
        const nullifierTreeRoot0 = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, includeUnCommit);

        let commonUserTxWrapperList = await Promise.all(txList.map(async (tx, txIndex) => {
            // ==============verify data_tree root is on root_tree==============
            const tx_dataTreeRoot = tx.data_tree_root;
            const blockHeight = (await this.rollupDB.queryBlockByDataTreeRoot(tx_dataTreeRoot)).blockHeight;
            const tx_dataTreeRoot_mp = this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, blockHeight, includeUnCommit);

            const nullifier1 = tx.input_note_nullifier_A;
            const nullifier2 = tx.input_note_nullifier_B;
            const commitment1 = tx.output_note_commitment_C;
            const commitment2 = tx.output_note_commitment_D;

            // ==============insert commitment1 into data_tree==============
            let dataTreeNum = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, includeUnCommit); // TODO from 1

            let emptyDataLeaf1_mp = this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeNum + 1n, includeUnCommit);
            // insert into data_tree 
            let dataLeafIdx1 = this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, commitment1, includeUnCommit);
            let commitmentMpWrapper1 = { value: commitment1, index: dataLeafIdx1, merklePath: emptyDataLeaf1_mp };
            // ==============insert commitment2 into data_tree==============
            // obtain the merkle proof on dataTreeRoot0 for commitment2
            let emptyDataLeaf2_mp = this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeNum + 2n, includeUnCommit);
            // insert into data_tree 
            let dataLeafIdx2 = this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, commitment2, includeUnCommit);
            let commitmentMpWrapper2 = { value: commitment2, index: dataLeafIdx2, merklePath: emptyDataLeaf2_mp };

            // ==============insert nullifier1 into nullifier_tree==============
            let nullifierTreeNum = this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, includeUnCommit); // TODO from 1


            // obtain nullifier1's predecessor's existence merkle proof
            let nullifier1_predecessor_and_mp = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, nullifier1);
            // let nullifier1_predecessor = nullifier1_predecessor_and_mp.leafData;
            // let nullifier1_predecessor_indx = nullifier1_predecessor_and_mp.index;
            // let nullifier1_predecessor_mp = nullifier1_predecessor_and_mp.siblingPath;
            // let nullifier1_leafData = { value: nullifier1.toBigInt(), nextIndex: nullifier1_predecessor.nextIndex, nextValue: nullifier1_predecessor.nextValue } as LeafData;
            let nullifier1_leafIndex = nullifierTreeNum + 1n;
            let nullifier1_emptyLeaf_mp = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifier1_leafIndex, includeUnCommit);
            let nullifierMpWrapper1 = { value: nullifier1, index: nullifier1_leafIndex, merklePath: nullifier1_emptyLeaf_mp };
            let circuitInputForNullifier1 = { nullifier1_predecessor_and_mp, nullifierMpWrapper1 };

            // append nullifier1 (underlying will update nullifier1's predecessor)
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, nullifier1, includeUnCommit);

            // ==============insert nullifier2 into nullifier_tree==============
            nullifierTreeNum = this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, includeUnCommit); // TODO from 1


            // obtain nullifier2's predecessor's existence merkle proof
            let nullifier2_predecessor_and_mp = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, nullifier2);
            // let nullifier2_predecessor = nullifier2_predecessor_and_mp.leafData;
            // let nullifier2_predecessor_indx = nullifier2_predecessor_and_mp.index;
            // let nullifier2_predecessor_mp = nullifier2_predecessor_and_mp.siblingPath;
            // let nullifier2_leafData = { value: nullifier2.toBigInt(), nextIndex: nullifier2_predecessor.nextIndex, nextValue: nullifier2_predecessor.nextValue } as LeafData;
            let nullifier2_leafIndex = nullifierTreeNum + 1n;
            let nullifier2_emptyLeaf_mp = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifier2_leafIndex, includeUnCommit);
            let nullifierMpWrapper2 = { value: nullifier2, index: nullifier2_leafIndex, merklePath: nullifier2_emptyLeaf_mp };
            let circuitInputForNullifier2 = { nullifier2_predecessor_and_mp, nullifierMpWrapper2 };

            // append nullifier2 (underlying will update nullifier2's predecessor)
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, nullifier2, includeUnCommit);

            // TODO compose CommonUserTxWrapper
            let commonUserTxWrapper = { txIndex, origin: tx, proofInfoWrapper: {} };
            // 
            // 
            // 
            return commonUserTxWrapper;
        }));
        return commonUserTxWrapperList;
    }

    private processDepositActions() {
        // select 'deposit_commitment' from db 
        // set this.depositCommitmentSize
        // compute JoinSplitDepositInput.depositWitness
        // compose JoinSplitDepositInput
        // asyncly send to 'Proof-Generator' to exec 'join_split_prover.deposit()'
        //
        //
        //
    }

    /**
     * when depositTxList(ie. JoinSplitProof list) comes back, need to go on further 
     */
    public whenDepositTxListComeBack(txList: any) {
        // preInsert into tree cache

        // check if it's the successor of an non-deposit one (ie. this.processingTxList.length % 2 == 1, last item of processingTxList ), true: combine them 

        // calc DUMMY tx num and append dummy if need!

        // combine txs above [two by two] and send to them to proof-generator for 'InnerRollupProver.proveTxBatch()'

    }

    /**
     * when a mergedEntity(ie. InnerRollupProof) comes back, merge further util only one mergedEntity left, then create L2Block.
     * @param rollupList 
     */
    public merge(rollupList: any) {
        // find out the suitable one in queue: this.rollupMergeEntityList
        // send them to proof-generator for 'InnerRollupProver.merge()'

        // when if there is only one left, send to proof-generator for 'BlockProver.prove()'

    }

    /**
     * 
     * @param block 
     */
    public whenL2BlockComeback(block: any) {
        // commit worldstateDB
        // start TypeOrm.transaction:
        //   insert Block into DB
        //   move related all MpL2Tx to L2Tx
        //   update related L2Tx
        // send to proof-generator for 'AnomixRollupContract.updateRollupState'
        //
        //
        //
    }

    public whenL1TxComeback(l1Tx: any) {
        // insert L1 tx into db
        // sign and broadcast it.
        //
        //
    }

}
