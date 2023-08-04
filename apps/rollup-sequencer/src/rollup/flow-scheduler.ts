
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, ProofTaskDto, ProofTaskType } from "@anomix/types";
import { DataMerkleWitness, DataRootWitnessData, InnerRollupInput, InnerRollupProof, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, DUMMY_FIELD, AnomixEntryContract, AnomixRollupContract, ActionType, JoinSplitDepositInput, DepositMerkleWitness, MINA } from "@anomix/circuits";
import { MerkleTreeId, WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { BlockProverOutputEntity, L2Tx, MemPlL2Tx, WithdrawInfo } from "@anomix/dao";
import { Field, PublicKey, Mina, PrivateKey } from 'snarkyjs';
import { $axios } from "@/lib";
import { syncAcctInfo } from "@anomix/utils";
import axios from "axios";
import { FLowTask, FlowTaskType } from "./constant";
import { getConnection } from "typeorm";

export class FlowScheduler {
    private leftNonDepositTx: JoinSplitProof;
    private pendingRollupMergeEntity: InnerRollupProof

    private depositStartIndexInBlock: Field
    private depositTreeRootInBlock: Field

    private targetDataRoot: Field
    private targetBlockId: number

    constructor(private flowId: string, private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    private async init() {
        // TODO clear dirty data on both rollupDB & worldStateDB
        this.worldStateDB.rollback();

        // fetch from contract
        const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
        await syncAcctInfo(entryContractAddr);
        await syncAcctInfo(rollupContractAddr);
        const rollupContract = new AnomixRollupContract(rollupContractAddr);
        const entryContract = new AnomixEntryContract(entryContractAddr);
        this.depositStartIndexInBlock = rollupContract.state.get().depositStartIndex;
        this.depositTreeRootInBlock = entryContract.depositState.get().depositRoot;
    }

    async start() {
        // clear dirty data on both rollupDB & worldStateDB at the beginning
        this.init();

        const innerRollupTxNum = config.innerRollup.txCount;
        const includeUnCommit = true;

        // TODO ask if 'Deposit-Processor' could stop
        let couldStopMarkDepositActions = false;
        let { code, data } = await axios.get(config.depositEndpoint_couldStopMarkDepositActions).then(r => {
            return r.data;
        })
        if (code == 0) {// could stop!
            couldStopMarkDepositActions = true;
            // if deposit-processor just sent a L1Tx, then could return newest root here.
            this.depositTreeRootInBlock = Field(data) ?? this.depositStartIndexInBlock;
        }

        if (couldStopMarkDepositActions) {
            // process deposit actions
            this.processDepositActions();
        }

        // query unhandled Non-Deposit tx list from RollupDB
        const mpTxList = await this.rollupDB.queryPendingTxList();
        if (mpTxList.length == 0 && !couldStopMarkDepositActions) {
            this.worldState.reset();//  end this flow!
            return;

        } else if (mpTxList.length == 0 && couldStopMarkDepositActions) {
            return;// interrupt this flow! 
        }

        // ================== below: txList.length > 0 ==================

        const mod = mpTxList.length % innerRollupTxNum;
        if (mod > 0) {//ie. == 1
            if (!couldStopMarkDepositActions) {// append dummy tx to the end, ignore the deposit ones at current block.
                // calc dummy tx
                let pendingTxSize = innerRollupTxNum - mod;
                // fill dummy tx
                for (let index = 0; index < pendingTxSize; index++) {
                    const dummyTx = config.joinsplitProofDummyTx;
                    mpTxList.push({
                        outputNoteCommitment1: dummyTx.publicOutput.outputNoteCommitment1.toString(),
                        outputNoteCommitment2: dummyTx.publicOutput.outputNoteCommitment2.toString(),

                        nullifier1: dummyTx.publicOutput.nullifier1.toString(),
                        nullifier2: dummyTx.publicOutput.nullifier2.toString(),
                        dataRoot: dummyTx.publicOutput.dataRoot.toString(),
                        proof: JSON.stringify(dummyTx.toJSON())
                    } as any);
                }
            } else {// wait for deposit tx's JoinsplitProof coming back, and append
                this.leftNonDepositTx = JoinSplitProof.fromJSON(JSON.parse(mpTxList[mpTxList.length - 1].proof));
            }
        }

        // pre insert into tree cache
        let innerRollup_proveTxBatchParamList = await this.preInsertIntoTreeCache(mpTxList);

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: this.flowId,
                taskType: FlowTaskType.ROLLUP_TX_MERGE,
                data: innerRollup_proveTxBatchParamList
            } as FLowTask<any>
        }

        // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
        await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB

    }

    private async preInsertIntoTreeCache(txList: MemPlL2Tx[]) {
        const innerRollup_proveTxBatchParamList: { innerRollupInput: InnerRollupInput, joinSplitProof1: string, joinSplitProof2: string }[] = []

        for (let i = 0; i < txList.length; i += 2) {
            const tx1 = txList[i];
            const tx2 = txList[i + 1];

            const dataStartIndex: Field = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true));
            const oldDataRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true);
            const nullStartIndex: Field = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true));
            const oldNullRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
            const dataRootsRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);


            // ================ tx1 commitment parts ============
            let dataTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true);
            const tx1OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx1.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment1), true);
            dataTreeCursor += 1n;

            const tx1OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx1.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
            if (Field(tx1.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment2), true);
                dataTreeCursor += 1n;
            }

            // ================ tx2 commitment parts ============
            const tx2OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx2.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment1), true);
            dataTreeCursor += 1n;

            const tx2OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx2.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
            if (Field(tx2.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment2), true);
                dataTreeCursor += 1n;
            }

            // ================ tx1 nullifier parts ============
            let nullifierTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true);

            const tx1LowLeafWitness1: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1), true);
            const tx1OldNullWitness1: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx1.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1), true)
                tx1.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }

            const tx1LowLeafWitness2: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2), true);
            const tx1OldNullWitness2: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx1.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2), true)
                tx1.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }

            // ================ tx2 nullifier parts ============
            const tx2LowLeafWitness1: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1), true);
            const tx2OldNullWitness1: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx2.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1), true)
                tx2.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }

            const tx2LowLeafWitness2: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2), true);
            const tx2OldNullWitness2: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx2.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2), true)
                tx2.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }


            // ================ root tree parts ============
            const tx1DataTreeRootIndex = await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx1.dataRoot}`);//TODO
            const tx1RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx1DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, tx1DataTreeRootIndex, false)
            };
            const tx2DataTreeRootIndex = await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx2.dataRoot}`);//TODO
            const tx2RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx2DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, tx2DataTreeRootIndex, false)
            };

            let oldDepositStartIndex = this.depositStartIndexInBlock;
            if (Field(tx1.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                oldDepositStartIndex = Field(tx1.depositIndex);
            } else if (Field(tx2.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                oldDepositStartIndex = Field(tx1.depositIndex);
            }

            innerRollup_proveTxBatchParamList.push(
                {
                    joinSplitProof1: tx1.proof,
                    joinSplitProof2: tx2.proof,
                    innerRollupInput: {
                        dataStartIndex,
                        oldDataRoot,
                        tx1OldDataWitness1,
                        tx1OldDataWitness2,
                        tx2OldDataWitness1,
                        tx2OldDataWitness2,

                        nullStartIndex,
                        oldNullRoot,
                        tx1LowLeafWitness1,
                        tx1LowLeafWitness2,
                        tx2LowLeafWitness1,
                        tx2LowLeafWitness2,

                        tx1OldNullWitness1,
                        tx1OldNullWitness2,
                        tx2OldNullWitness1,
                        tx2OldNullWitness2,

                        dataRootsRoot,
                        tx1RootWitnessData,
                        tx2RootWitnessData,

                        depositRoot: this.depositTreeRootInBlock,
                        oldDepositStartIndex
                    }
                }
            );
        }
        return innerRollup_proveTxBatchParamList;
    }

    /**
     * !!mv to deposit_processor!!
     */
    private async processDepositActions() {
        // select 'deposit_commitment' from db order by 'depositNoteIndex' ASC
        // compute JoinSplitDepositInput.depositWitness
        // compose JoinSplitDepositInput
        // asyncly send to 'Proof-Generator' to exec 'join_split_prover.deposit()'

        let depositCommitmentList = (await this.rollupDB.queryDepositCommitmentList(this.depositStartIndexInBlock)) ?? [];
        // the sequence is as deposit-actions
        const joinSplitDepositInputList = await Promise.all(await depositCommitmentList.map(async c => {
            return JoinSplitDepositInput.fromJSON({
                publicValue: c.depositValue,
                publicOwner: c.sender,
                publicAssetId: c.assetId,
                dataRoot: this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).toString(),
                depositRoot: this.depositTreeRootInBlock.toString(),
                depositNoteCommitment: c.depositNoteCommitment,
                depositNoteIndex: c.depositNoteIndex,
                depositWitness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DEPOSIT_TREE, BigInt(c.depositNoteIndex), false)
            });
        }))

        // send to proof-generator for 'JoinSplitProver.deposit(*)'
        await $axios.post<BaseResponse<string>>('/proof-gen',
            {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: {},
                payload: {
                    flowId: this.flowId,
                    taskType: FlowTaskType.DEPOSIT_JOIN_SPLIT,
                    data: joinSplitDepositInputList
                } as FLowTask<any>
            } as ProofTaskDto<any, any>);

    }

    /**
     * when depositTxList(ie. JoinSplitProof list) comes back, need to go on further 
     */
    async whenDepositTxListComeBack(depositTxList: any[]) {
        let tmpList: JoinSplitProof[] = [];
        depositTxList = depositTxList.map(j => { return JoinSplitProof.fromJSON(j) })
        if (this.leftNonDepositTx) {// add 'leftNonDepositTx' at first one 
            tmpList = [this.leftNonDepositTx, ...depositTxList];
        } else {
            tmpList = depositTxList;
        }

        // calc dummy tx
        let pendingTxSize = config.innerRollup.txCount - tmpList.length % config.innerRollup.txCount;
        // fill dummy tx
        for (let index = 0; index < pendingTxSize; index++) {
            const dummyTx = config.joinsplitProofDummyTx;
            tmpList.push(dummyTx);
        }

        let mpTxList = tmpList.map(jp => {
            return {
                outputNoteCommitment1: jp.publicOutput.outputNoteCommitment1.toString(),
                outputNoteCommitment2: jp.publicOutput.outputNoteCommitment2.toString(),

                nullifier1: jp.publicOutput.nullifier1.toString(),
                nullifier2: jp.publicOutput.nullifier2.toString(),
                dataRoot: jp.publicOutput.dataRoot.toString(),
                proof: JSON.stringify(jp.toJSON())
            } as any as MemPlL2Tx;
        })

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: this.flowId,
                taskType: FlowTaskType.ROLLUP_TX_MERGE,
                data: await this.preInsertIntoTreeCache(mpTxList)
            } as FLowTask<any>
        }
        // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
        await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB

        await this.rollupDB.updateDepositState(depositTxList);
    }

    /**
     * when a mergedEntity(ie. InnerRollupProof) comes back, merge further util only one mergedEntity left, then create L2Block.
     * @param innerRollupProofList 
     */
    async merge(innerRollupProof: any) {
        // match the order and send them to proof-generator for 'InnerRollupProver.merge()'
        // when if there is only one left, send to proof-generator for 'BlockProver.prove()'

        const irp = InnerRollupProof.fromJSON(innerRollupProof);
        if (this.pendingRollupMergeEntity) {
            let proofPairs: InnerRollupProof[] = []
            if (this.pendingRollupMergeEntity.publicOutput.newDataRoot.equals(irp.publicOutput.oldDataRoot).toBoolean()) {
                proofPairs = [this.pendingRollupMergeEntity, irp]
            } else {
                proofPairs = [irp, this.pendingRollupMergeEntity]
            }

            // construct proofTaskDto
            const proofTaskDto: ProofTaskDto<any, any> = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: {},
                payload: {
                    flowId: this.flowId,
                    taskType: FlowTaskType.ROLLUP_MERGE,
                    data: proofPairs
                } as FLowTask<any>
            }
            // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
            await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB

            this.pendingRollupMergeEntity = null as any;

            return;
        }

        const oldDataRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false);
        // if the last merged result, then send to proof-generator to exec BlockProver
        if (oldDataRoot.equals(irp.publicOutput.oldDataRoot)
            .and(irp.publicOutput.newDataRoot.equals(this.targetDataRoot)).toBoolean()) {

            // construct proofTaskDto
            const proofTaskDto: ProofTaskDto<any, any> = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: {},
                payload: {
                    flowId: this.flowId,
                    taskType: FlowTaskType.BLOCK_PROVE,
                    data: irp
                } as FLowTask<any>
            }
            // send to proof-generator to exec BlockProver
            await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB

        }

        this.pendingRollupMergeEntity = irp;
    }

    /**
     * update all related status and send to trigger ROLLUP_CONTRACT
     * @param block 
     */
    async whenL2BlockComeback(block: any) {
        this.worldStateDB.commit();
        this.rollupDB.commit(block);

        // send to proof-generator for 'AnomixRollupContract.updateRollupState'
        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: this.flowId,
                taskType: FlowTaskType.ROLLUP_CONTRACT_CALL,
                data: block
            } as FLowTask<any>
        }
        // send to proof-generator to exec BlockProver
        await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB
    }

    async whenL1TxComeback(tx: any) {
        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(tx);
        await l1Tx.sign([PrivateKey.fromBase58(config.sequencerPrivateKey)]).send().then(txHash => {// TODO what if it fails currently!
            // insert L1 tx into db, underlying also save to task for 'Tracer-Watcher'
            this.rollupDB.saveL1Tx(this.targetBlockId, txHash.hash());
        }).catch(reason => {
            // TODO log it
            console.log(tx, ' failed!', 'reason: ', JSON.stringify(reason));
        });

        this.worldState.reset();
    }

}
