
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, DepositStatus, L2TxStatus, ProofTaskDto, ProofTaskType, MerkleTreeId, L1TxStatus } from "@anomix/types";
import { DEPOSIT_ACTION_BATCH_SIZE, DUMMY_FIELD, AnomixEntryContract, ActionType, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { DepositActionEventFetchRecord, DepositCommitment, DepositProverOutput, DepositRollupBatch, DepositTreeTrans, MemPlL2Tx } from "@anomix/dao";
import { $axiosProofGenerator } from "@/lib";
import { syncAcctInfo } from "@anomix/utils";
import { FlowTask, FlowTaskType } from "@anomix/types";
import { getConnection, In } from "typeorm";
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey } from 'snarkyjs';
import { assert } from "console";

/**
 * deposit_processor rollup flow at 'deposit_tree'
 */
export class FlowScheduler {
    private depositStartIndexInBatch: Field
    private depositTreeRootOnchain: Field
    private currentActionsHash: Field

    private targetHandledActionsNum: Field
    private targetDepositRoot: Field
    private targetActionsHash: Field

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
        // try to send to proof-generator and end the flow.
        */
        const includeUnCommit = true;

        const connection = getConnection();

        const depositCommitmentRepo = connection.getRepository(DepositCommitment);
        const originDcList = await depositCommitmentRepo.find({ where: { status: DepositStatus.PENDING }, order: { id: 'ASC' } }) ?? [];
        if (originDcList.length == 0) {// if no, end.
            return;
        }

        const depositCommitmentList = [...originDcList];
        const DUMMY_ACTION = DUMMY_FIELD;
        let dummyActionSize = DEPOSIT_ACTION_BATCH_SIZE - depositCommitmentList.length % DEPOSIT_ACTION_BATCH_SIZE;
        while (dummyActionSize > 0) {// check if need dummy_actions,
            depositCommitmentList.push(({ depositNoteCommitment: DUMMY_ACTION } as any) as DepositCommitment)
            dummyActionSize--;
        }

        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            // preinsert into tree cache,
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

            // update status to MARKED
            originDcList.forEach(dc => {
                dc.status = DepositStatus.MARKED;
            });
            depositCommitmentRepo.save(originDcList);

            // get the (startBlock, endBlock) of depositTreeTrans
            const recordIds = depositCommitmentList.map(dc => {
                return dc.depositActionEventFetchRecordId;
            })
            const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
            const fetchRecordList = await depositActionEventFetchRecordRepo.find({ where: { id: In([...recordIds]) }, order: { id: 'ASC' } })!;
            const startBlock = fetchRecordList[0].startBlock;
            const endBlock = fetchRecordList[fetchRecordList.length - 1].endBlock;

            let depositTreeTrans = new DepositTreeTrans();
            depositTreeTrans.startActionHash = this.currentActionsHash.toString();
            depositTreeTrans.startActionIndex = this.depositStartIndexInBatch.toString();
            depositTreeTrans.nextActionHash = this.targetActionsHash.toString();
            depositTreeTrans.nextActionIndex = this.targetHandledActionsNum.toString();
            depositTreeTrans.status = L1TxStatus.PROCESSING;// initial status
            depositTreeTrans.startBlock = startBlock;
            depositTreeTrans.endBlock = endBlock;
            const depositTreeTransRepo = connection.getRepository(DepositTreeTrans);
            depositTreeTrans = await depositTreeTransRepo.save(depositTreeTrans);// record it in memory for later usage

            // MUST save the circuit's parameters for later new proof-gen tries
            const rollupBatchRepo = connection.getRepository(DepositRollupBatch);
            await rollupBatchRepo.save({
                inputParam: JSON.stringify(batchParamList),
                transId: depositTreeTrans.id
            } as DepositRollupBatch);

            // commit
            await queryRunner.commitTransaction();
            await this.worldStateDB.commit();

            // try to send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
            // if fail, deposit-rollup-proof-watcher will trigger again later.
            try {
                const proofTaskDto = {
                    taskType: ProofTaskType.ROLLUP_FLOW,
                    index: undefined,
                    payload: {
                        flowId: this.flowId,// no need actually later version!
                        taskType: FlowTaskType.DEPOSIT_BATCH_MERGE,
                        data: { transId: depositTreeTrans.id, data: batchParamList }
                    }
                } as ProofTaskDto<any, FlowTask<any>>;
                await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                    if (r.data.code == 1) {
                        throw new Error(r.data.msg);
                    }
                });// TODO future: could improve when fail by 'timeout' after retry
            } catch (error) {
                console.error(error);
            }

        } catch (error) {
            console.error(error);

            await queryRunner.rollbackTransaction();
            await this.worldStateDB.rollback();

            throw error;

        } finally {
            await queryRunner.release();
        }
    }
}
