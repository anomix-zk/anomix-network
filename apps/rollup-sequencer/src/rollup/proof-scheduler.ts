
import { WorldStateDB, RollupDB, IndexDB } from "@/worldstate";
import config from "@/lib/config";
import { BaseResponse, BlockStatus, RollupTaskDto, RollupTaskType, ProofTaskDto, ProofTaskType } from "@anomix/types";
import { InnerRollupProof } from "@anomix/circuits";
import { BlockProverOutput, Block, InnerRollupBatch, Task, TaskStatus, TaskType } from "@anomix/dao";
import { Mina, PrivateKey } from 'snarkyjs';
import { $axios } from "@/lib";
import { FlowTaskType } from "./constant";
import { getConnection } from "typeorm";
import axios from "axios";

export class ProofScheduler {

    constructor(private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    async startBatchMerge(blockId: number) {
        // TODO need stop 'deposit-processor'
        // or move this to 'Coordinator'?!!!
        //

        // query related InnerRollupBatch regarding 'blockId'
        const innerRollupBatchRepo = getConnection().getRepository(InnerRollupBatch);
        const innerRollupBatch = await innerRollupBatchRepo.findOne({ where: { blockId } });
        if (!innerRollupBatch) {
            throw new Error(`cannot find innerRollupBatch by blockId:${blockId}`);
        }
        const innerRollupBatchParamList = JSON.parse(innerRollupBatch.inputParam);

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
        await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB
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
        await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB
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
        await axios.post<BaseResponse<string>>(config.coordinator_notify_url, rollupTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB
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
        await $axios.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry, like save the 'innerRollupInputList' into DB
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
