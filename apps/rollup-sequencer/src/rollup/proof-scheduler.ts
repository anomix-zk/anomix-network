
import { WorldStateDB, RollupDB, IndexDB } from "@/worldstate";
import config from "@/lib/config";
import { BaseResponse, BlockStatus, RollupTaskDto, RollupTaskType, ProofTaskDto, ProofTaskType, FlowTaskType } from "@anomix/types";
import { ActionType, InnerRollupProof } from "@anomix/circuits";
import { BlockProverOutput, Block, InnerRollupBatch, Task, TaskStatus, TaskType, L2Tx } from "@anomix/dao";
import { Mina, PrivateKey } from 'snarkyjs';
import { $axiosProofGenerator, $axiosDepositProcessor, $axiosCoordinator } from "@/lib";
import { getConnection } from "typeorm";
import axios from "axios";

export class ProofScheduler {

    constructor(private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    async startBatchMerge(blockId: number) {
        let latestDepositTreeRoot: string = undefined as any as string;
        const connection = getConnection();

        await connection.getRepository(L2Tx)
            .find({ where: { blockId } })
            .then(async txList => {
                const hasDeposit = txList!.some(tx => {
                    return tx.actionType == ActionType.DEPOSIT.toString();
                });
                if (hasDeposit) {
                    // MUST stop 'deposit-processor', need WAIT until timeout!! will return the latest DepositTreeRoot if deposit_processor just sent out a deposit_batch L1tx.
                    await $axiosDepositProcessor.post<BaseResponse<string>>('/rollup/stop-mark').then(r => {
                        if (r.data.code == 1) {
                            throw new Error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                        }
                        latestDepositTreeRoot = r.data.data;
                    });
                }

            });

        // query related InnerRollupBatch regarding 'blockId'
        const innerRollupBatchRepo = connection.getRepository(InnerRollupBatch);
        const innerRollupBatch = await innerRollupBatchRepo.findOne({ where: { blockId } });
        if (!innerRollupBatch) {
            throw new Error(`cannot find innerRollupBatch by blockId:${blockId}`);
        }
        const innerRollupBatchParamList = JSON.parse(innerRollupBatch.inputParam);

        if (latestDepositTreeRoot) {// ie. has depositL2tx, then need change to latestDepositTreeRoot
            // change to latest deposit tree root
            innerRollupBatchParamList.forEach(param => {
                param.depositRoot = latestDepositTreeRoot
            })
        }

        // send to proof-generator, construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: { blockId },
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.ROLLUP_TX_BATCH_MERGE,
                data: innerRollupBatchParamList
            }
        }

        // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*) && merge(*)'
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    /**
     * when a MergedResult(ie. InnerRollupProof) comes back, then create L2Block.
     * @param innerRollupProofList 
     */
    async whenMergedResultComeBack(innerRollupProof: any) {
        // verify proof??
        //

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.BLOCK_PROVE,
                data: innerRollupProof
            }
        }
        // send to proof-generator to exec BlockProver
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    /**
     * update all related status and send to trigger ROLLUP_CONTRACT
     * @param block 
     */
    async whenL2BlockComeback(data: { blockId: number, blockProvedResult: any }) {
        // verify proof??
        //

        const { blockId, blockProvedResult } = data;

        // update all related status : BlockStatus.Proved, 
        // save it into db 
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        queryRunner.startTransaction();

        const blockRepo = connection.getRepository(Block);
        const block = (await blockRepo.findOne({ where: { id: blockId } }))!;
        block.status = BlockStatus.PROVED;
        blockRepo.save(block);

        const blockProverOutputRepo = connection.getRepository(BlockProverOutput);
        const blockProverOutput = new BlockProverOutput();
        blockProverOutput.blockId = blockId;
        blockProverOutput.output = JSON.stringify(blockProvedResult);
        blockProverOutputRepo.save(blockProverOutput);

        queryRunner.commitTransaction();

        // notify Coordinator
        const rollupTaskDto = {} as RollupTaskDto<any, any>;
        rollupTaskDto.taskType = RollupTaskType.ROLLUP_PROCESS;
        rollupTaskDto.payload = { blockId }

        $axiosCoordinator.post<BaseResponse<any>>('/rollup/proof-notify', rollupTaskDto).then(async r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            } else if (r.data.data?.taskType == RollupTaskType.ROLLUP_CONTRACT_CALL) {
                //  if this block aligns with AnomixRollupContract's onchain states, coordinator would further command triggerring 'callRollupContract'
                await this.callRollupContract(blockId);
            }
        });// TODO future: could improve when fail by 'timeout' after retry

    }

    async callRollupContract(blockId: number) {
        // load BlockProvedResult regarding 'blockId' from db
        const connection = getConnection();
        const blockProverOutputRepo = connection.getRepository(BlockProverOutput);

        const blockProvedResult = (await blockProverOutputRepo.findOne({ where: { blockId } }))!;
        const blockProvedResultStr = JSON.parse(blockProvedResult.output);

        // send to proof-generator for 'AnomixRollupContract.updateRollupState'
        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.ROLLUP_CONTRACT_CALL,
                data: blockProvedResultStr
            }
        }
        // send to proof-generator to trigger ROLLUP_CONTRACT
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    async whenL1TxComeback(data: { blockId: number, tx: any }) {
        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(data.tx);
        await l1Tx.sign([PrivateKey.fromBase58(config.sequencerPrivateKey)]).send().then(txHash => {// TODO what if it fails currently!
            const txHash0 = txHash.hash()!;

            // insert L1 tx into db, underlying 
            const connection = getConnection();
            const queryRunner = connection.createQueryRunner();
            queryRunner.startTransaction();
            const blockRepo = connection.getRepository(Block);
            blockRepo.update({ id: data.blockId }, { l1TxHash: txHash0 });

            // save task for 'Tracer-Watcher' and also save to task for 'Tracer-Watcher'
            const taskRepo = connection.getRepository(Task);
            const task = new Task();
            task.status = TaskStatus.PENDING;
            task.taskType = TaskType.ROLLUP;
            task.txHash = txHash0;
            taskRepo.save(task);

            queryRunner.commitTransaction();

        }).catch(reason => {
            // TODO log it
            console.log(data.tx, ' failed!', 'reason: ', JSON.stringify(reason));
        });
    }

}
