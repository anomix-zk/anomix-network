// initialize tree with fixed empty commitment from Value_Note.

import { IndexDB, RollupDB, RollupFlow } from "@/rollup";
import { WorldStateDB } from "./worldstate-db";
import { AnomixEntryContract, JoinSplitDepositInput } from "@anomix/circuits";
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey, UInt32, Reducer } from 'snarkyjs';
import config from "@/lib/config";
import { syncAcctInfo } from "@anomix/utils";
import { BaseResponse, FlowTask, FlowTaskType, ProofTaskDto, ProofTaskType, RollupTaskDto, RollupTaskType, MerkleTreeId } from "@anomix/types";
import { $axios } from "@/lib";
import { getConnection } from "typeorm";
import { L2Tx } from "@anomix/dao";
import axios from "axios";

export * from './worldstate-db'
export class WorldState {
    private flow: RollupFlow
    depositTreeRootOnchain: any;

    constructor(public worldStateDB: WorldStateDB, public rollupDB: RollupDB, public indexDB: IndexDB) { }

    get ongingFlow() {
        return this.flow;
    }

    /**
     * start a new Flow
     */
    async startNewFlow() {
        this.flow = new RollupFlow(this, this.worldStateDB, this.rollupDB, this.indexDB);
        await this.flow.start();
    }

    /**
     * reset
     */
    async reset() {
        await this.flow.end();

        this.flow = undefined as any as RollupFlow;
    }

    /**
     * process proof result from 'proof-generators'
     * @param proofTaskDto 
     */
    async processProofResult(proofTaskDto: ProofTaskDto<any, any>) {
        const { taskType, index, payload } = proofTaskDto;

        if (taskType == ProofTaskType.DEPOSIT_JOIN_SPLIT) {
            await this.whenDepositL2TxListComeBack(payload);

        } else {// Rollup flow
            const { flowId, taskType, data } = payload as FlowTask<any>;
            if (!(this.ongingFlow?.flowId == flowId)) {// check if not valid
                throw new Error("error flowId!");
            }

            if (taskType == FlowTaskType.DEPOSIT_BATCH_MERGE) {
                await this.ongingFlow.flowScheduler.whenMergedResultComeBack(data);
            } else if (taskType == FlowTaskType.DEPOSIT_UPDATESTATE) {
                await this.ongingFlow.flowScheduler.whenRollupL1TxComeBack(data);
            }
        }
    }

    /**
     * since the leveldb can only support one process, so this processing is moved from 'sequencer' to here. 
     */
    async processDepositActions(blockId: number) {
        // select 'outputNoteCommitment1' from depositL2Tx order by 'depositIndex' ASC
        // compute JoinSplitDepositInput.depositWitness
        // compose JoinSplitDepositInput
        // asyncly send to 'Proof-Generator' to exec 'join_split_prover.deposit()'
        const connection = getConnection();
        const l2txRepo = connection.getRepository(L2Tx);
        const depositL2TxList = await l2txRepo.find({ where: { blockId }, order: { depositIndex: 'ASC' } }) ?? [];
        if (depositL2TxList.length == 0) {
            return;
        }

        const txIdJoinSplitDepositInputList = await Promise.all(await depositL2TxList.map(async tx => {
            return {
                txId: tx.id,
                data: JoinSplitDepositInput.fromJSON({
                    publicValue: tx.publicValue,
                    publicOwner: tx.publicOwner,
                    publicAssetId: tx.publicAssetId,
                    dataRoot: tx.dataRoot,
                    depositRoot: tx.depositRoot,
                    depositNoteCommitment: tx.outputNoteCommitment1,
                    depositNoteIndex: tx.depositIndex,
                    depositWitness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DEPOSIT_TREE, BigInt(tx.depositIndex), false)
                })
            };
        }))

        // send to proof-generator for 'JoinSplitProver.deposit(*)'
        await $axios.post<BaseResponse<string>>('/proof-gen',
            {
                taskType: ProofTaskType.DEPOSIT_JOIN_SPLIT,
                index: undefined,
                payload: { blockId, data: txIdJoinSplitDepositInputList }
            } as ProofTaskDto<any, any>);
    }

    /**
     * when depositTxList(ie. JoinSplitProof list) comes back, need to go on further 
     */
    private async whenDepositL2TxListComeBack(payload: { blockId: number, data: { txId: number, data: any }[] }) {
        // verify proof ??
        //
        const blockId = payload.blockId;

        // save it into db accordingly
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        queryRunner.startTransaction();

        const l2txRepo = await connection.getRepository(L2Tx);
        payload.data.forEach(async d => {
            await l2txRepo.update({ id: d.txId }, { proof: d.data });
        })

        queryRunner.commitTransaction();

        // construct rollupTaskDto
        const rollupTaskDto: RollupTaskDto<any, any> = {
            taskType: RollupTaskType.DEPOSIT_PROCESS,
            index: undefined,
            payload: { blockId }
        }
        // notify coordinator
        await axios.post<BaseResponse<string>>(config.coordinator_notify_url, rollupTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB
    }
}
