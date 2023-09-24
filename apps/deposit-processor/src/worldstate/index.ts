// initialize tree with fixed empty commitment from Value_Note.

import { IndexDB, RollupDB, RollupFlow } from "@/rollup";
import { WorldStateDB } from "./worldstate-db";
import { JoinSplitDepositInput, ActionType } from "@anomix/circuits";
import { BaseResponse, FlowTask, FlowTaskType, ProofTaskDto, ProofTaskType, RollupTaskDto, RollupTaskType, MerkleTreeId } from "@anomix/types";
import { $axiosCoordinator, $axiosProofGenerator, getDateString } from "@/lib";
import { getConnection } from "typeorm";
import { L2Tx, MemPlL2Tx } from "@anomix/dao";
import { ProofScheduler } from "@/rollup/proof-scheduler";
import fs from "fs";
import { getLogger } from "@/lib/logUtils";
import { randomUUID } from "crypto";

const logger = getLogger('deposit-processor-WorldState');

export * from './worldstate-db'
export class WorldState {
    private flow: RollupFlow;
    private proofScheduler: ProofScheduler;

    constructor(public worldStateDB: WorldStateDB, public rollupDB: RollupDB, public indexDB: IndexDB) {
        this.proofScheduler = new ProofScheduler(this, worldStateDB, rollupDB, indexDB);
    }

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
            const fileName = './DEPOSIT_JOIN_SPLIT_proofTaskDto_proofResult' + getDateString() + '.json';
            fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
            logger.info(`save proofTaskDto into ${fileName}`);

            await this.whenDepositL2TxListComeBack(payload);

        } else {// deposit rollup proof flow
            const { flowId, taskType, data } = payload as FlowTask<any>;

            if (taskType == FlowTaskType.DEPOSIT_BATCH_MERGE) {
                const fileName = './DEPOSIT_BATCH_MERGE_proofTaskDto_proofResult' + getDateString() + '.json';
                fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
                logger.info(`save proofTaskDto into ${fileName}`);

                await this.proofScheduler.whenMergedResultComeBack(data);

            } else if (taskType == FlowTaskType.DEPOSIT_UPDATESTATE) {
                const fileName = './DEPOSIT_UPDATESTATE_proofTaskDto_proofResult' + getDateString() + '.json';
                fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
                logger.info(`save proofTaskDto into ${fileName}`);

                await this.proofScheduler.whenDepositRollupL1TxComeBack(data);
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
        const depositL2TxList = await l2txRepo.find({ where: { blockId, actionType: ActionType.DEPOSIT.toString() }, order: { depositIndex: 'ASC' } }) ?? [];
        if (depositL2TxList.length == 0) {
            logger.info(`fetch no depositL2TxList of [blockId = ${blockId}, ActionType == ${ActionType.DEPOSIT.toString()}]`);
            return;
        }

        const txIdJoinSplitDepositInputList = await Promise.all(await depositL2TxList.map(async tx => {
            return {
                txId: tx.id,
                data: {
                    publicValue: tx.publicValue,
                    publicOwner: tx.publicOwner,
                    publicAssetId: tx.publicAssetId,
                    dataRoot: tx.dataRoot,
                    depositRoot: tx.depositRoot,
                    depositNoteCommitment: tx.outputNoteCommitment1,
                    depositNoteIndex: tx.depositIndex,
                    depositWitness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DEPOSIT_TREE, BigInt(tx.depositIndex), false)
                }
            };
        }))

        const proofTaskDto = {
            taskType: ProofTaskType.DEPOSIT_JOIN_SPLIT,
            index: { uuid: randomUUID().toString() },
            payload: { blockId, data: txIdJoinSplitDepositInputList }
        } as ProofTaskDto<any, any>;

        const fileName = './DEPOSIT_JOIN_SPLIT_proofTaskDto_proofReq' + getDateString() + '.json';
        fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
        logger.info(`save proofTaskDto into ${fileName}`);

        // send to proof-generator for 'JoinSplitProver.deposit(*)'
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto);

        logger.info('sent to proof-generator, done.');
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
        try {
            const promises: Promise<any>[] = [];
            payload.data.forEach(async d => {
                promises.push(
                    (async () => {
                        await queryRunner.manager.update(L2Tx, { id: d.txId }, { proof: JSON.stringify(d.data) });
                    })()
                )
            })
            await Promise.all(promises);
            await queryRunner.commitTransaction();// !must commit the data, then notify coordinator!

        } catch (error) {
            logger.error(error);
            console.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }

        // construct rollupTaskDto
        const rollupTaskDto: RollupTaskDto<any, any> = {
            taskType: RollupTaskType.DEPOSIT_JOINSPLIT,
            index: undefined,
            payload: { blockId }
        }

        const fileName = './DEPOSIT_JOINSPLIT_rollupTaskDto_proofReq' + getDateString() + '.json';
        fs.writeFileSync(fileName, JSON.stringify(rollupTaskDto));
        logger.info(`save rollupTaskDto into ${fileName}`);

        // notify coordinator
        await $axiosCoordinator.post<BaseResponse<string>>('/rollup/proof-notify', rollupTaskDto).then(r => {
            if (r.data.code == 1) {
                logger.warn(r.data.msg);
            }
        });

    }
}
