
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { Tree } from "@anomix/types";
import { LeafData } from "@anomix/merkle-tree";
import { JoinSplitOutput, JoinSplitProof } from "@anomix/circuits";
import { PrivateKey, Mina } from "snarkyjs";

export class FlowScheduler {
    private processingTxList: JoinSplitProof[]
    private depositCommitmentSize: number
    private pendingTxSize: number
    // private depositActionList: JoinSplitDepositInput[]

    constructor(private rollupDB: RollupDB, private worldStateDB: WorldStateDB) { }

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
        let couldStopDeposit = true;
        //
        //
        if (couldStopDeposit) {
            // process deposit actions
            this.processDepositActions();
        }

        // query unhandled Non-Deposit tx list from RollupDB
        const txList = await this.rollupDB.queryPendingTxList();
        if (txList.length == 0 && !couldStopDeposit) {
            // TODO end this flow!
            // rm 'flow' from WorldState object
            //
        } else if (txList.length == 0 && couldStopDeposit) {
            // TODO interrupt this flow!
            //
            //
        }

        // preinsert Non-Deposit ones & Padding ones, i.e. txList
        // query all related merkle-proof and compose the CommonUserTxWrapper for each L2 tx 
        let commonUserTxWrapperList = await this.preInsertIntoTreeCache(includeUnCommit, txList);
        // TODO set to this.processingTxList
        //

        if (!couldStopDeposit) {// ask 'deposit-processor' again
            // couldStopDeposit = true;
            //
            //
            if (couldStopDeposit) {// if answer true
                // process deposit actions
                this.processDepositActions();
            }
        }

        if (!couldStopDeposit) {// still cannot stop
            // calc dummy tx
            let len = txList.length + this.depositCommitmentSize;
            this.pendingTxSize = len % innerRollupTxNum;
            // fill dummy tx
            for (let index = 0; index < this.pendingTxSize; index++) {
                this.processingTxList.push(config.joinsplitProofDummyTx);
            }
        }

        // send non-deposit ones to proof-generator for 'InnerRollupProver.proveTxBatch()'
        //
        //



        // check if need one Padding tx
        let paddingTxNum = innerRollupTxNum - txList.length % innerRollupTxNum;
        while (paddingTxNum == 0) {//Actually Pickles only supports recursively verifying 0, 1 or 2 proofs
            commonUserTxWrapperList.push({});// TODO commonUserTxWrapper for padding
            paddingTxNum--;
        }

        // exec InnerRollup circuit.
        let innerRollupCircuitInput = new Array[commonUserTxWrapperList.length / innerRollupTxNum];
        let start = 0;
        while (start < commonUserTxWrapperList.length) {
            let end = start + innerRollupTxNum
            innerRollupCircuitInput.push(commonUserTxWrapperList.slice(start, end));
            start += end + 1;
        }
        // !!!! Worker Thread start !!!!
        // innerRollupCircuitInput
        // exec innerRollup circuit
        // push results into Queue && persist innerRollup&update L2tx status into DB！

        // !!!! Worker Thread start !!!!
        // reduce(accumulate) all results one and one
        //
        //
        // when meet the maximum size of outerRullup then persist the outRollup into DB！then trigger RollupSmartContract's method, construct a tx, and sign, broadcast!
        let currentInnerRollupReducedNum = 0;// TODO
        let outerRullupSizeLimit = 10;// TODO
        if (currentInnerRollupReducedNum == outerRullupSizeLimit) {
            // trigger RollupSmartContract's method, and construct a tx, and sign, broadcast!
            let sequencerPrivateKey = PrivateKey.fromBase58(config.sequencerPrivateKey);
            let feePayer = sequencerPrivateKey.toPublicKey();
            let tx = await Mina.transaction(feePayer, () => {
                let contractMethodCircuitInput = {};
                // invoke RollupSmartContract's method...
                // 
                // 
            });
            tx.prove();
            tx.sign([sequencerPrivateKey]);

            // update each tx's status
            await this.rollupDB.preConfirmTxList(txList);

            // commit new worldstate
            await this.worldStateDB.commit();
        }

    }

    private async preInsertIntoTreeCache(includeUnCommit: boolean, txList: any[]) {
        const rootTreeRoot0 = this.worldStateDB.getRoot(Tree.ROOT_TREE, includeUnCommit);
        const dataTreeRoot0 = this.worldStateDB.getRoot(Tree.DATA_TREE, includeUnCommit);
        const nullifierTreeRoot0 = this.worldStateDB.getRoot(Tree.NULLIFIER_TREE, includeUnCommit);

        let commonUserTxWrapperList = await Promise.all(txList.map(async (tx, txIndex) => {
            // ==============verify data_tree root is on root_tree==============
            const tx_dataTreeRoot = tx.data_tree_root;
            const blockHeight = (await this.rollupDB.queryBlockByDataTreeRoot(tx_dataTreeRoot)).blockHeight;
            const tx_dataTreeRoot_mp = this.worldStateDB.getSiblingPath(Tree.ROOT_TREE, blockHeight, includeUnCommit);

            const nullifier1 = tx.input_note_nullifier_A;
            const nullifier2 = tx.input_note_nullifier_B;
            const commitment1 = tx.output_note_commitment_C;
            const commitment2 = tx.output_note_commitment_D;

            // ==============insert commitment1 into data_tree==============
            let dataTreeNum = this.worldStateDB.getNumLeaves(Tree.DATA_TREE, includeUnCommit); // TODO from 1

            let emptyDataLeaf1_mp = this.worldStateDB.getSiblingPath(Tree.DATA_TREE, dataTreeNum + 1n, includeUnCommit);
            // insert into data_tree 
            let dataLeafIdx1 = this.worldStateDB.appendLeaf(Tree.DATA_TREE, commitment1, includeUnCommit);
            let commitmentMpWrapper1 = { value: commitment1, index: dataLeafIdx1, merklePath: emptyDataLeaf1_mp };
            // ==============insert commitment2 into data_tree==============
            // obtain the merkle proof on dataTreeRoot0 for commitment2
            let emptyDataLeaf2_mp = this.worldStateDB.getSiblingPath(Tree.DATA_TREE, dataTreeNum + 2n, includeUnCommit);
            // insert into data_tree 
            let dataLeafIdx2 = this.worldStateDB.appendLeaf(Tree.DATA_TREE, commitment2, includeUnCommit);
            let commitmentMpWrapper2 = { value: commitment2, index: dataLeafIdx2, merklePath: emptyDataLeaf2_mp };

            // ==============insert nullifier1 into nullifier_tree==============
            let nullifierTreeNum = this.worldStateDB.getNumLeaves(Tree.NULLIFIER_TREE, includeUnCommit); // TODO from 1


            // obtain nullifier1's predecessor's existence merkle proof
            let nullifier1_predecessor_and_mp = await this.worldStateDB.findPreviousValueAndMp(Tree.NULLIFIER_TREE, nullifier1);
            // let nullifier1_predecessor = nullifier1_predecessor_and_mp.leafData;
            // let nullifier1_predecessor_indx = nullifier1_predecessor_and_mp.index;
            // let nullifier1_predecessor_mp = nullifier1_predecessor_and_mp.siblingPath;
            // let nullifier1_leafData = { value: nullifier1.toBigInt(), nextIndex: nullifier1_predecessor.nextIndex, nextValue: nullifier1_predecessor.nextValue } as LeafData;
            let nullifier1_leafIndex = nullifierTreeNum + 1n;
            let nullifier1_emptyLeaf_mp = await this.worldStateDB.getSiblingPath(Tree.NULLIFIER_TREE, nullifier1_leafIndex, includeUnCommit);
            let nullifierMpWrapper1 = { value: nullifier1, index: nullifier1_leafIndex, merklePath: nullifier1_emptyLeaf_mp };
            let circuitInputForNullifier1 = { nullifier1_predecessor_and_mp, nullifierMpWrapper1 };

            // append nullifier1 (underlying will update nullifier1's predecessor)
            this.worldStateDB.appendLeaf(Tree.DATA_TREE, nullifier1, includeUnCommit);

            // ==============insert nullifier2 into nullifier_tree==============
            nullifierTreeNum = this.worldStateDB.getNumLeaves(Tree.NULLIFIER_TREE, includeUnCommit); // TODO from 1


            // obtain nullifier2's predecessor's existence merkle proof
            let nullifier2_predecessor_and_mp = await this.worldStateDB.findPreviousValueAndMp(Tree.NULLIFIER_TREE, nullifier2);
            // let nullifier2_predecessor = nullifier2_predecessor_and_mp.leafData;
            // let nullifier2_predecessor_indx = nullifier2_predecessor_and_mp.index;
            // let nullifier2_predecessor_mp = nullifier2_predecessor_and_mp.siblingPath;
            // let nullifier2_leafData = { value: nullifier2.toBigInt(), nextIndex: nullifier2_predecessor.nextIndex, nextValue: nullifier2_predecessor.nextValue } as LeafData;
            let nullifier2_leafIndex = nullifierTreeNum + 1n;
            let nullifier2_emptyLeaf_mp = await this.worldStateDB.getSiblingPath(Tree.NULLIFIER_TREE, nullifier2_leafIndex, includeUnCommit);
            let nullifierMpWrapper2 = { value: nullifier2, index: nullifier2_leafIndex, merklePath: nullifier2_emptyLeaf_mp };
            let circuitInputForNullifier2 = { nullifier2_predecessor_and_mp, nullifierMpWrapper2 };

            // append nullifier2 (underlying will update nullifier2's predecessor)
            this.worldStateDB.appendLeaf(Tree.DATA_TREE, nullifier2, includeUnCommit);

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

        // check if it's the successor of an non-deposit one (ie. this.processingTxList.length % 2 == 1), true: combine them 
        // calc Padding tx num and append dummy if need
        // combine txs above [two by two] and send to them to proof-generator for 'InnerRollupProver.proveTxBatch()'

    }

    /**
     * when a mergedEntity(ie. InnerRollupProof) comes back, merge further util only one mergedEntity left, then create L2Block.
     * @param rollupList 
     */
    public merge(rollupList: any) {
        // find out the suitable one in queue
        // send them to proof-generator for 'InnerRollupProver.merge()'

        // when if there is only one left, send to proof-generator for 'BlockProver.prove()'

    }

    public whenL2BlockComeback(block: any) {
        // commit worldstateDB
        // start TypeOrm.transaction:
        //   insert Block into DB
        //   update related L2Tx
        // send to proof-generator for 'AnomixRollupContract.updateRollupState'
    }

    public whenL1TxComeback(l1Tx: any) {
        // insert L1 tx into db
        // sign and broadcast it.
    }

}
