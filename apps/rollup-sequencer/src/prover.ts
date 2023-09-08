import { parentPort } from "worker_threads";
import { WorldStateDB, RollupDB, IndexDB } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { ProofScheduler } from "./rollup/proof-scheduler";
import { ProofTaskDto, RollupTaskDto, RollupTaskType, FlowTask, FlowTaskType } from '@anomix/types';
import { getLogger } from "@/lib/logUtils";
import { initORM } from "./lib";
const logger = getLogger('prover');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

await initORM();

// init leveldb
// const worldStateDB = new WorldStateDB(config.worldStateDBPath);
// worldStateDB.loadTrees();// just need load!

// init RollupDB
// const rollupDB = new RollupDB();

// init IndexDB
// const indexDB = new IndexDB(config.indexedDBPath);

const proofScheduler = new ProofScheduler();

process!.on('message', async dto => {
    if ((dto as any).taskType >= RollupTaskType.ROLLUP_PROCESS) {// TODO MUST improve it！！
        const rollupTask = dto as RollupTaskDto<any, any>;

        switch (rollupTask.taskType) {
            case RollupTaskType.ROLLUP_PROCESS:
                await proofScheduler.startBatchMerge(rollupTask.payload);
                break;

            case RollupTaskType.ROLLUP_CONTRACT_CALL:
                await proofScheduler.callRollupContract(rollupTask.payload);
                break;

            default: // rid it
                logger.info('rid RollupTask', JSON.stringify(rollupTask));
                break;
        }

        return;
    }

    // ============================== below 'ProofTaskDto' from 'proof-generators' ============================== //
    // then proof result from 'proof-generators'
    const proofTaskDto = dto as ProofTaskDto<any, any>;
    const flowTask = (proofTaskDto.payload) as FlowTask<any>;
    switch (flowTask.taskType) {
        case FlowTaskType.ROLLUP_TX_BATCH_MERGE:
            await proofScheduler.whenMergedResultComeBack(proofTaskDto.index, flowTask.data);
            break;
        case FlowTaskType.BLOCK_PROVE:
            await proofScheduler.whenL2BlockComeback(flowTask.data);
            break;
        case FlowTaskType.ROLLUP_CONTRACT_CALL:
            await proofScheduler.whenL1TxComeback(flowTask.data);
            break;
        default: // rid it
            logger.info('rid FlowTask', JSON.stringify(flowTask));
            break;
    }
});
