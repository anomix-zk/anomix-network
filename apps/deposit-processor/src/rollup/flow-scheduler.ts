
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, DepositStatus, L2TxStatus, ProofTaskDto, ProofTaskType, MerkleTreeId, L1TxStatus, DepositTreeTransStatus } from "@anomix/types";
import { DEPOSIT_ACTION_BATCH_SIZE, DUMMY_FIELD, AnomixEntryContract, ActionType, DepositActionBatch, DepositRollupState, DepositRollupProof, DepositMerkleWitness, checkMembershipAndAssert, JoinSplitOutput } from "@anomix/circuits";
import { WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { DepositActionEventFetchRecord, DepositCommitment, DepositProverOutput, DepositRollupBatch, DepositTreeTrans, DepositTreeTransCache, MemPlL2Tx } from "@anomix/dao";
import { $axiosProofGenerator, getDateString } from "@/lib";
import { syncAcctInfo } from "@anomix/utils";
import { FlowTask, FlowTaskType, DepositTransCacheType } from "@anomix/types";
import { getConnection, In } from "typeorm";
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey, UInt64 } from 'o1js';
import fs from "fs";
import { getLogger } from "@/lib/logUtils";
import { INITIAL_LEAF } from "@anomix/merkle-tree";
import { randomUUID } from "crypto";

const logger = getLogger('flow-scheduler');

/**
 * deposit_processor rollup flow at 'deposit_tree'
 */
export class FlowScheduler {
    private currentIndex: Field
    private currentDepositRoot: Field
    private currentActionsHash: Field

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
        this.currentIndex = entryContract.depositState.get().currentIndex;
        // this.currentDepositRoot = entryContract.depositState.get().depositRoot;
        this.currentActionsHash = entryContract.depositState.get().currentActionsHash;

        // console.assert(this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false) == this.depositStartIndexInBatch.toBigInt());
        // console.assert(this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).equals(this.currentDepositRootOnchain).toBoolean());
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
            let dcTrans0 = await queryRunner.manager.findOne(DepositTreeTrans, { order: { id: 'DESC' } });
            this.currentIndex = dcTrans0 ? Field(dcTrans0.nextActionIndex) : this.currentIndex;
            this.currentDepositRoot = Field(this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false));
            this.currentActionsHash = dcTrans0 ? Field(dcTrans0.nextActionHash) : this.currentActionsHash;

            this.depositStartIndexInBatch = this.currentIndex;

            let originDcList = await queryRunner.manager.find(DepositCommitment, { where: { status: DepositStatus.PENDING }, order: { id: 'ASC' } }) ?? [];
            if (originDcList.length == 0) {// if no, end.
                return;
            }

            // order: asc
            originDcList = originDcList.sort((a, b) => {
                return Number(a.depositNoteIndex) - Number(b.depositNoteIndex);
            });

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
            let depositRootX = this.currentDepositRoot;
            let currentIndexX = this.currentIndex;
            let currentActionsHashX = this.currentActionsHash;
            const batchCnt = depositCommitmentList.length / DEPOSIT_ACTION_BATCH_SIZE;
            for (let i = 0; i < batchCnt; i++) {
                const actions: Field[] = [];
                const merkleWitnesses: DepositMerkleWitness[] = [];
                let param = {
                    depositRollupState: new DepositRollupState({
                        depositRoot: depositRootX,
                        currentIndex: currentIndexX,
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
                    checkMembershipAndAssert(DUMMY_ACTION, Field(leafIndex), merkleWitness, this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUnCommit));

                    param.depositActionBatch.actions.push(targetAction);
                    param.depositActionBatch.merkleWitnesses.push(merkleWitness);

                    if (targetAction.equals(DUMMY_ACTION).not().toBoolean()) {// skip dummy ones
                        await this.worldStateDB.appendLeaf(MerkleTreeId.DEPOSIT_TREE, targetAction);

                        currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
                            currentActionsHashX,// 当前已累积值
                            AccountUpdate.Actions.hash([targetAction.toFields()]) // 
                        );
                        console.log('currentActionsHashX:' + currentActionsHashX.toString());
                    }
                }

                depositRootX = this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUnCommit);
                currentIndexX = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUnCommit));
            }
            this.targetActionsHash = currentActionsHashX;
            this.targetDepositRoot = depositRootX;
            this.targetHandledActionsNum = currentIndexX;

            // get the (startBlock, endBlock) of depositTreeTrans
            const recordIds = new Set(originDcList.map(dc => {
                return dc.depositActionEventFetchRecordId;
            }))
            console.log("recordIds: " + JSON.stringify(recordIds));
            const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
            const fetchRecordList = await depositActionEventFetchRecordRepo.find({ where: { id: In([...recordIds]) }, order: { id: 'ASC' } })!;
            const startBlock = fetchRecordList[0].startBlock;
            const endBlock = fetchRecordList[fetchRecordList.length - 1].endBlock;

            let depositTreeTrans = new DepositTreeTrans();
            depositTreeTrans.startActionHash = this.currentActionsHash.toString();
            depositTreeTrans.startActionIndex = this.depositStartIndexInBatch.toString();
            depositTreeTrans.nextActionHash = this.targetActionsHash.toString();
            depositTreeTrans.nextActionIndex = this.targetHandledActionsNum.toString();
            depositTreeTrans.startDepositRoot = this.currentDepositRoot.toString();
            depositTreeTrans.nextDepositRoot = this.targetDepositRoot.toString();
            depositTreeTrans.status = DepositTreeTransStatus.PROCESSING;// initial status
            depositTreeTrans.startBlock = startBlock;
            depositTreeTrans.endBlock = endBlock;
            depositTreeTrans = await queryRunner.manager.save(depositTreeTrans);// record it in memory for later usage

            // MUST save the circuit's parameters for later new proof-gen tries
            const batch = new DepositRollupBatch();
            batch.inputParam = JSON.stringify(batchParamList);
            batch.transId = depositTreeTrans.id
            await queryRunner.manager.save(batch);

            const vDepositTxList: MemPlL2Tx[] = [];
            // update status to MARKED
            originDcList.forEach(dc => {
                dc.depositTreeTransId = depositTreeTrans.id;
                dc.status = DepositStatus.MARKED;

                const memPlL2Tx = new MemPlL2Tx();
                memPlL2Tx.actionType = ActionType.DEPOSIT.toString();
                memPlL2Tx.nullifier1 = DUMMY_FIELD.toString();
                memPlL2Tx.nullifier2 = DUMMY_FIELD.toString();
                memPlL2Tx.outputNoteCommitment1 = dc.depositNoteCommitment;
                memPlL2Tx.outputNoteCommitment2 = DUMMY_FIELD.toString();
                memPlL2Tx.publicValue = dc.depositValue;
                memPlL2Tx.publicOwner = dc.sender;
                memPlL2Tx.publicAssetId = dc.assetId;
                memPlL2Tx.dataRoot = '0';
                memPlL2Tx.depositRoot = '0';
                memPlL2Tx.depositIndex = dc.depositNoteIndex;
                memPlL2Tx.txFee = '0';
                memPlL2Tx.txFeeAssetId = dc.assetId;
                memPlL2Tx.encryptedData1 = dc.encryptedNote;
                memPlL2Tx.status = L2TxStatus.PENDING
                memPlL2Tx.txHash = new JoinSplitOutput({
                    actionType: ActionType.DEPOSIT,
                    outputNoteCommitment1: Field(memPlL2Tx.outputNoteCommitment1),
                    outputNoteCommitment2: DUMMY_FIELD,
                    nullifier1: DUMMY_FIELD,
                    nullifier2: DUMMY_FIELD,
                    publicValue: UInt64.zero,
                    publicOwner: PublicKey.fromBase58(memPlL2Tx.publicOwner),
                    publicAssetId: Field(memPlL2Tx.publicAssetId),
                    dataRoot: DUMMY_FIELD,
                    txFee: UInt64.zero,
                    txFeeAssetId: Field(memPlL2Tx.txFeeAssetId),
                    depositRoot: DUMMY_FIELD,
                    depositIndex: Field(memPlL2Tx.depositIndex),
                }).hash().toString();

                // pre-construct depositTx
                vDepositTxList.push(memPlL2Tx);
            });
            await queryRunner.manager.save(originDcList);

            logger.info('transform DepositCommitment list into MemPlL2Tx list...');
            // insert depositTx into memorypool
            await queryRunner.manager.save(vDepositTxList);

            const cachedUpdates = this.worldStateDB.exportCacheUpdates(MerkleTreeId.DEPOSIT_TREE);
            const deTransCachedUpdates = new DepositTreeTransCache();
            deTransCachedUpdates.dcTransId = depositTreeTrans.id;
            deTransCachedUpdates.cache = JSON.stringify(cachedUpdates);
            deTransCachedUpdates.type = DepositTransCacheType.DEPOSIT_TREE_UPDATES;//  0
            await queryRunner.manager.save(deTransCachedUpdates);

            // commit
            await queryRunner.commitTransaction();
            await this.worldStateDB.commit();

            // try to send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
            // if fail, deposit-rollup-proof-watcher will trigger again later.
            try {
                const proofTaskDto = {
                    taskType: ProofTaskType.ROLLUP_FLOW,
                    index: { uuid: randomUUID().toString() },
                    payload: {
                        flowId: this.flowId,// no need actually later version!
                        taskType: FlowTaskType.DEPOSIT_BATCH_MERGE,
                        data: {
                            transId: depositTreeTrans.id,
                            data: batchParamList
                        }
                    }
                } as ProofTaskDto<any, FlowTask<any>>;

                const fileName = './DEPOSIT_BATCH_MERGE_proofTaskDto_proofReq' + getDateString() + '.json';
                fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));


                await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                    if (r.data.code == 1) {
                        throw new Error(r.data.msg);
                    }
                });
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
