
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, DepositStatus, L2TxStatus, ProofTaskDto, ProofTaskType, RollupTaskDto, MerkleTreeId, RollupTaskType } from "@anomix/types";
import { DataMerkleWitness, DataRootWitnessData, DEPOSIT_ACTION_BATCH_SIZE, InnerRollupInput, InnerRollupProof, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, DUMMY_FIELD, AnomixEntryContract, AnomixRollupContract, ActionType, JoinSplitDepositInput, DepositMerkleWitness, MINA, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { Account, BlockProverOutput, DepositActionEventFetchRecord, DepositCommitment, DepositTreeTrans, L2Tx, MemPlL2Tx, Task, TaskStatus, TaskType, WithdrawInfo } from "@anomix/dao";
import { $axiosProofGenerator } from "@/lib";
import { syncAcctInfo } from "@anomix/utils";
import { FlowTask, FlowTaskType } from "@anomix/types";
import { getConnection, In } from "typeorm";
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey, UInt32, Reducer } from 'snarkyjs';
import { assert } from "console";
import axios from "axios";

/**
 * deposit_processor rollup flow at 'deposit_tree'
 */
export class FlowScheduler {
    private nonDummyDepositCommitmentList: DepositCommitment[]

    private depositStartIndexInBatch: Field
    private depositTreeRootOnchain: Field
    private currentActionsHash: Field

    private targetHandledActionsNum: Field
    private targetDepositRoot: Field
    private targetActionsHash: Field

    private depositTreeTrans: DepositTreeTrans

    constructor(private flowId: string, private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    private async init() {

        // clear dirty data on both rollupDB & worldStateDB
        this.worldStateDB.rollback();

        // fetch from contract
        const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        await syncAcctInfo(entryContractAddr);
        const entryContract = new AnomixEntryContract(entryContractAddr);
        this.depositStartIndexInBatch = entryContract.depositState.get().handledActionsNum;
        this.depositTreeRootOnchain = entryContract.depositState.get().depositRoot;
        this.currentActionsHash = entryContract.depositState.get().currentActionsHash;

        assert(this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false) == this.depositStartIndexInBatch.toBigInt());
        assert(this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).equals(this.depositTreeRootOnchain).toBoolean());
    }

    async start() {
        // clear dirty data on worldStateDB at the beginning
        this.init();
        /*
        // fetch all pending actions from db, if no,  end the flow.
        // check if need dummy_actions,
        // preinsert into tree cache,
        // send to proof-generator and interrupt the flow.
        // when actions come back, send to proof-generator for deposit_contract.
        // when L1tx come back, sign it and broadcast it.
        */
        const includeUnCommit = true;

        const connection = getConnection();
        const depositCommitmentRepo = connection.getRepository(DepositCommitment);

        const depositCommitmentList = await depositCommitmentRepo.find({ where: { status: DepositStatus.PENDING }, order: { id: 'ASC' } }) ?? [];
        if (depositCommitmentList.length == 0) {
            return;
        }

        // keep it in memory
        this.nonDummyDepositCommitmentList = [...depositCommitmentList];

        const DUMMY_ACTION = DUMMY_FIELD;
        let dummyActionSize = DEPOSIT_ACTION_BATCH_SIZE - depositCommitmentList.length % DEPOSIT_ACTION_BATCH_SIZE;
        while (dummyActionSize > 0) {
            depositCommitmentList.push(({ depositNoteCommitment: DUMMY_ACTION } as any) as DepositCommitment)
            dummyActionSize--;
        }

        const batchParamList: { depositRollupState: DepositRollupState, depositActionBatch: DepositActionBatch }[] = [];
        let depositRootX = this.depositTreeRootOnchain;
        let handledActionsNumX = this.depositStartIndexInBatch;
        let currentActionsHashX = this.currentActionsHash;
        const batchCnt = depositCommitmentList.length / DEPOSIT_ACTION_BATCH_SIZE;
        for (let i = 0; i < batchCnt; i++) {
            let param = {
                depositRollupState: {
                    depositRoot: depositRootX,
                    handledActionsNum: handledActionsNumX,
                    currentActionsHash: currentActionsHashX
                } as any as DepositRollupState,
                depositActionBatch: {
                    actions: [],
                    merkleWitnesses: []
                } as any as DepositActionBatch
            };

            batchParamList.push(param);

            for (let j = i * DEPOSIT_ACTION_BATCH_SIZE; j < (i + 1) * DEPOSIT_ACTION_BATCH_SIZE; j++) {
                const dc = depositCommitmentList[j];
                const targetAction = Field(dc.depositNoteCommitment);

                const leafIndex = this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUnCommit);
                const merkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DEPOSIT_TREE, leafIndex, includeUnCommit);
                this.worldStateDB.appendLeaf(MerkleTreeId.DEPOSIT_TREE, targetAction);

                currentActionsHashX = AccountUpdate.Actions.updateSequenceState(currentActionsHashX, AccountUpdate.Actions.hash([targetAction.toFields()]));

                param.depositActionBatch.actions.push(targetAction);
                param.depositActionBatch.merkleWitnesses.push(merkleWitness);
            }

            depositRootX = this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUnCommit);
            handledActionsNumX = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUnCommit));
        }

        this.targetActionsHash = currentActionsHashX;
        this.targetDepositRoot = depositRootX;
        this.targetHandledActionsNum = handledActionsNumX;

        // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
        const proofTaskDto = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: undefined,
            payload: {
                flowId: this.flowId,
                taskType: FlowTaskType.DEPOSIT_BATCH_MERGE,
                data: batchParamList
            }
        } as ProofTaskDto<any, FlowTask<any>>;
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    /**
     * update all related status and send to trigger 'AnomixEntryContract.updateDepositState'.
     * @param result 
     */
    async whenMergedResultComeBack(result: any) {
        // to 'DepositRollupProof'
        const drProof = DepositRollupProof.fromJSON(result);

        assert(drProof.publicOutput.source.currentActionsHash.equals(this.currentActionsHash));
        assert(drProof.publicOutput.source.depositRoot.equals(this.depositTreeRootOnchain));
        assert(drProof.publicOutput.source.handledActionsNum.equals(this.depositStartIndexInBatch));

        assert(drProof.publicOutput.target.currentActionsHash.equals(this.targetActionsHash));
        assert(drProof.publicOutput.target.depositRoot.equals(this.targetDepositRoot));
        assert(drProof.publicOutput.target.handledActionsNum.equals(this.targetHandledActionsNum));

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        const vDepositTxList: MemPlL2Tx[] = [];
        const recordIds = new Set();
        this.nonDummyDepositCommitmentList.forEach(dc => {// DepositTreeTrans
            dc.status = DepositStatus.MARKED;

            // pre-construct depositTx
            vDepositTxList.push({
                actionType: ActionType.DEPOSIT.toString(),
                nullifier1: DUMMY_FIELD.toString(),
                nullifier2: DUMMY_FIELD.toString(),
                outputNoteCommitment1: dc.depositNoteCommitment,
                outputNoteCommitment2: DUMMY_FIELD.toString(),
                publicValue: dc.depositValue,
                publicOwner: dc.sender,
                publicAssetId: dc.assetId,
                depositIndex: dc.depositNoteIndex,
                txFee: '0',
                txFeeAssetId: dc.assetId,
                encryptedData1: dc.encryptedNote,
                status: L2TxStatus.PENDING
            } as MemPlL2Tx);

            recordIds.add(dc.depositActionEventFetchRecordId);// TODO need test it if work?
        });

        // insert depositTx into memorypool
        const memPlL2TxRepo = connection.getRepository(MemPlL2Tx);
        await memPlL2TxRepo.save(vDepositTxList);

        // update nonDummyDepositCommitmentList
        const dcRepo = connection.getRepository(DepositCommitment);
        await dcRepo.save(this.nonDummyDepositCommitmentList);

        const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
        const fetchRecordList = await depositActionEventFetchRecordRepo.find({ where: { id: In([...recordIds]) }, order: { id: 'ASC' } })!;
        const startBlock = fetchRecordList[0].startBlock;
        const endBlock = fetchRecordList[fetchRecordList.length - 1].endBlock;

        const depositTreeTrans = new DepositTreeTrans();
        depositTreeTrans.startActionHash = this.currentActionsHash.toString();
        depositTreeTrans.startActionIndex = this.depositStartIndexInBatch.toString();
        depositTreeTrans.nextActionHash = this.targetActionsHash.toString();
        depositTreeTrans.nextActionIndex = this.targetHandledActionsNum.toString();
        depositTreeTrans.startBlock = startBlock;
        depositTreeTrans.endBlock = endBlock;
        const depositTreeTransRepo = connection.getRepository(DepositTreeTrans);
        this.depositTreeTrans = await depositTreeTransRepo.save(depositTreeTrans);// record it in memory for later usage

        // send to proof-generator for 'AnomixEntryContract.updateDepositState'
        const proofTaskDto = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: undefined,
            payload: {
                flowId: this.flowId,
                taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
                data: result
            }
        } as ProofTaskDto<any, FlowTask<any>>;

        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry

        await queryRunner.commitTransaction();

        await this.worldStateDB.commit();// TODO extreme case: if this fail, then should restore manually
    }

    async whenRollupL1TxComeBack(tx: any) {
        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(tx);
        await l1Tx.sign([PrivateKey.fromBase58(config.sequencerPrivateKey)]).send().then(async txHash => {// TODO what if it fails currently!
            // insert L1 tx into db, underlying also save to task for 'Tracer-Watcher'
            this.depositTreeTrans.txHash = txHash.hash()!;
            await this.rollupDB.updateTreeTransAndAddWatchTask(this.depositTreeTrans);
        }).catch(reason => {
            // TODO log it
            console.log(tx, ' failed!', 'reason: ', JSON.stringify(reason));
        });

        this.worldState.reset();
    }

}
