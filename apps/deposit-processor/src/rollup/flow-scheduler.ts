
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, DepositStatus, L2TxStatus, ProofTaskDto, ProofTaskType, MerkleTreeId, L1TxStatus, DepositTreeTransStatus } from "@anomix/types";
import { DEPOSIT_ACTION_BATCH_SIZE, DUMMY_FIELD, AnomixEntryContract, ActionType, DepositActionBatch, DepositRollupState, DepositRollupProof, DepositMerkleWitness, checkMembershipAndAssert } from "@anomix/circuits";
import { WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { DepositActionEventFetchRecord, DepositCommitment, DepositProverOutput, DepositRollupBatch, DepositTreeTrans, MemPlL2Tx } from "@anomix/dao";
import { $axiosProofGenerator } from "@/lib";
import { syncAcctInfo } from "@anomix/utils";
import { FlowTask, FlowTaskType } from "@anomix/types";
import { getConnection, In } from "typeorm";
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey } from 'snarkyjs';
import fs from "fs";
import { getLogger } from "@/lib/logUtils";
import { INITIAL_LEAF } from "@anomix/merkle-tree";

const logger = getLogger('flow-scheduler');

/**
 * deposit_processor rollup flow at 'deposit_tree'
 */
export class FlowScheduler {
    private currentHandledActionsNumOnchain: Field
    private currentTreeRootOnchain: Field
    private currentActionsHashOnchain: Field

    private depositStartIndexInBatch: Field

    private targetHandledActionsNum: Field
    private targetDepositRoot: Field
    private targetActionsHash: Field

    constructor(private flowId: string, private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    private async init() {

        // clear dirty data on both rollupDB & worldStateDB
        await this.worldStateDB.rollback();

        // fetch from contract
        const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        await syncAcctInfo(entryContractAddr);
        const entryContract = new AnomixEntryContract(entryContractAddr);
        this.currentHandledActionsNumOnchain = entryContract.depositState.get().handledActionsNum;
        this.currentTreeRootOnchain = entryContract.depositState.get().depositRoot;
        this.currentActionsHashOnchain = entryContract.depositState.get().currentActionsHash;

        this.depositStartIndexInBatch = this.currentHandledActionsNumOnchain.add(1);

        console.assert(this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false) == this.depositStartIndexInBatch.toBigInt());
        console.assert(this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).equals(this.currentTreeRootOnchain).toBoolean());
    }

    async start() {
        // clear dirty data on worldStateDB at the beginning
        await this.init();
        /*
        // fetch all pending actions from db, if no,  end the flow.
        // check if need dummy_actions,
        // preinsert into tree cache,
        // try to send to proof-generator and end the flow.
        */
        const includeUnCommit = true;

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();
        try {
            const originDcList = await queryRunner.manager.find(DepositCommitment, { where: { status: DepositStatus.PENDING }, order: { id: 'ASC' } }) ?? [];
            if (originDcList.length == 0) {// if no, end.
                return;
            }

            const depositCommitmentList = [...originDcList];
            const DUMMY_ACTION = INITIAL_LEAF;
            const mod = depositCommitmentList.length % DEPOSIT_ACTION_BATCH_SIZE;
            let dummyActionSize = mod > 0 ? DEPOSIT_ACTION_BATCH_SIZE - mod : 0;
            while (dummyActionSize > 0) {// check if need dummy_actions,
                const dc = new DepositCommitment();
                dc.depositNoteCommitment = DUMMY_ACTION.toString();
                depositCommitmentList.push(dc);
                dummyActionSize--;
            }
            // preinsert into tree cache,
            const batchParamList: { depositRollupState: DepositRollupState, depositActionBatch: DepositActionBatch }[] = [];
            let depositRootX = this.currentTreeRootOnchain;
            let handledActionsNumX = this.currentHandledActionsNumOnchain;
            let currentActionsHashX = this.currentActionsHashOnchain;
            const batchCnt = depositCommitmentList.length / DEPOSIT_ACTION_BATCH_SIZE;
            for (let i = 0; i < batchCnt; i++) {
                const actions: Field[] = [];
                const merkleWitnesses: DepositMerkleWitness[] = [];
                let param = {
                    depositRollupState: new DepositRollupState({
                        depositRoot: depositRootX,
                        handledActionsNum: handledActionsNumX,
                        currentActionsHash: currentActionsHashX
                    }),
                    depositActionBatch: new DepositActionBatch({
                        actions,
                        merkleWitnesses
                    })
                };

                batchParamList.push(param);

                for (let j = i * DEPOSIT_ACTION_BATCH_SIZE; j < (i + 1) * DEPOSIT_ACTION_BATCH_SIZE; j++) {
                    const dc = depositCommitmentList[j];
                    const targetAction = Field(dc.depositNoteCommitment);

                    const leafIndex = this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUnCommit);
                    const merkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DEPOSIT_TREE, leafIndex, includeUnCommit);
                    // assert for test
                    checkMembershipAndAssert(INITIAL_LEAF, Field(leafIndex), merkleWitness, this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUnCommit));

                    param.depositActionBatch.actions.push(targetAction);
                    param.depositActionBatch.merkleWitnesses.push(merkleWitness);

                    if (targetAction.equals(INITIAL_LEAF).not().toBoolean()) {// skip dummy ones
                        await this.worldStateDB.appendLeaf(MerkleTreeId.DEPOSIT_TREE, targetAction);

                        currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
                            currentActionsHashX,// 当前已累积值
                            AccountUpdate.Actions.hash([targetAction.toFields()]) // 
                        );
                        console.log('currentActionsHashX:' + currentActionsHashX.toString());
                    }
                }

                depositRootX = this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUnCommit);
                handledActionsNumX = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUnCommit) - 1n);// exclude the leafIndex-0 INIT_LEAF
            }
            this.targetActionsHash = currentActionsHashX;
            this.targetDepositRoot = depositRootX;
            this.targetHandledActionsNum = handledActionsNumX;

            // get the (startBlock, endBlock) of depositTreeTrans
            const recordIds = new Set(originDcList.map(dc => {
                return dc.depositActionEventFetchRecordId;
            }))
            const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
            const fetchRecordList = await depositActionEventFetchRecordRepo.find({ where: { id: In([...recordIds]) }, order: { id: 'ASC' } })!;
            const startBlock = fetchRecordList[0].startBlock;
            const endBlock = fetchRecordList[fetchRecordList.length - 1].endBlock;

            let depositTreeTrans = new DepositTreeTrans();
            depositTreeTrans.startActionHash = this.currentActionsHashOnchain.toString();
            depositTreeTrans.startActionIndex = this.depositStartIndexInBatch.toString();
            depositTreeTrans.nextActionHash = this.targetActionsHash.toString();
            depositTreeTrans.nextActionIndex = this.targetHandledActionsNum.toString();
            depositTreeTrans.status = DepositTreeTransStatus.PROCESSING;// initial status
            depositTreeTrans.startBlock = startBlock;
            depositTreeTrans.endBlock = endBlock;
            depositTreeTrans = await queryRunner.manager.save(depositTreeTrans);// record it in memory for later usage

            // MUST save the circuit's parameters for later new proof-gen tries
            const batch = new DepositRollupBatch();
            batch.inputParam = JSON.stringify(batchParamList);
            batch.transId = depositTreeTrans.id
            await queryRunner.manager.save(batch);

            // update status to MARKED
            originDcList.forEach(dc => {
                dc.depositTreeTransId = depositTreeTrans.id;
                dc.status = DepositStatus.MARKED;
            });
            await queryRunner.manager.save(originDcList);

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
                        data: {
                            transId: depositTreeTrans.id,
                            data: batchParamList
                        }
                    }
                } as ProofTaskDto<any, FlowTask<any>>;
                fs.writeFileSync('./DEPOSIT_BATCH_MERGE_proofTaskDto_proofReq' + new Date().getTime() + '.json', JSON.stringify(proofTaskDto));

                await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                    if (r.data.code == 1) {
                        throw new Error(r.data.msg);
                    }
                });// TODO future: could improve when fail by 'timeout' after retry
            } catch (error) {
                logger.error(error);
            }

        } catch (error) {
            logger.error(error);

            await queryRunner.rollbackTransaction();
            await this.worldStateDB.rollback();

            throw error;

        } finally {
            await queryRunner.release();
        }
    }
}
