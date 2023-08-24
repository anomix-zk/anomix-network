// initialize tree with fixed empty commitment from Value_Note.

import { IndexDB, RollupDB, RollupFlow } from "@/rollup";
import { WorldStateDB } from "./worldstate-db";
import { JoinSplitDepositInput } from "@anomix/circuits";
import { BaseResponse, FlowTask, FlowTaskType, ProofTaskDto, ProofTaskType, RollupTaskDto, RollupTaskType, MerkleTreeId } from "@anomix/types";
import { $axiosCoordinator, $axiosProofGenerator } from "@/lib";
import { getConnection } from "typeorm";
import { L2Tx } from "@anomix/dao";
import { ProofScheduler } from "@/rollup/proof-scheduler";

export * from './worldstate-db'
export class WorldState {
    private flow: RollupFlow;
    private proofScheduler: ProofScheduler;
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

        } else {// deposit rollup proof flow
            const { flowId, taskType, data } = payload as FlowTask<any>;

            if (taskType == FlowTaskType.DEPOSIT_BATCH_MERGE) {
                await this.proofScheduler.whenMergedResultComeBack(data);
            } else if (taskType == FlowTaskType.DEPOSIT_UPDATESTATE) {
                await this.proofScheduler.whenRollupL1TxComeBack(data);
            }
        }
    }

    /**
     * since the leveldb can only support one process, so this processing is moved from 'sequencer' to here. 
     * * TODO but I think it would be reasonable to mv it to 'sequencer' and http-get all 
     */
    async execActionDepositJoinSplit(blockId: number) {
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
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen',
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
        await queryRunner.startTransaction();

        const l2txRepo = await connection.getRepository(L2Tx);
        payload.data.forEach(async d => {
            await l2txRepo.update({ id: d.txId }, { proof: d.data });
        })

        await queryRunner.commitTransaction();

        // construct rollupTaskDto
        const rollupTaskDto: RollupTaskDto<any, any> = {
            taskType: RollupTaskType.DEPOSIT_JOINSPLIT,
            index: undefined,
            payload: { blockId }
        }
        // notify coordinator
        await $axiosCoordinator.post<BaseResponse<string>>('/rollup/proof-notify', rollupTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }
}
