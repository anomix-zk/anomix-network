import { getLogger } from './lib/logUtils';

import { parentPort } from "worker_threads";
import { WorldStateDB, RollupDB, IndexDB } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { ProofScheduler } from "./rollup/proof-scheduler";
import { ProofTaskDto, RollupTaskDto, RollupTaskType, FlowTask, FlowTaskType } from '@anomix/types';
import { initORM } from "./lib";
import fs from "fs";
import { getDateString } from "./lib/timeUtils";
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
    try {
        if ((dto as any).taskType >= RollupTaskType.ROLLUP_PROCESS) {// TODO MUST improve it！！
            const rollupTask = dto as RollupTaskDto<any, any>;

            switch (rollupTask.taskType) {
                case RollupTaskType.ROLLUP_PROCESS:
                    await proofScheduler.startBatchMerge(rollupTask.payload);
                    break;

                case RollupTaskType.ROLLUP_CONTRACT_CALL:
                    await proofScheduler.callRollupContract(rollupTask.payload.blockId);
                    break;

                default: // rid it
                    logger.info('rid RollupTask', JSON.stringify(rollupTask));
                    break;
            }
        } else {
            // ============================== below 'ProofTaskDto' from 'proof-generators' ============================== //
            // then proof result from 'proof-generators'
            const proofTaskDto = dto as ProofTaskDto<any, any>;
            const flowTask = (proofTaskDto.payload) as FlowTask<any>;
            switch (flowTask.taskType) {
                case FlowTaskType.ROLLUP_TX_BATCH_MERGE:
                    fs.writeFileSync(`./ROLLUP_TX_BATCH_MERGE_proofTaskDto_${proofTaskDto.index?.uuid}_proofResult_${proofTaskDto.index.blockId}_${getDateString()}.json`, JSON.stringify(proofTaskDto));
                    await proofScheduler.whenMergedResultComeBack(proofTaskDto.index.blockId, flowTask.data);
                    break;
                case FlowTaskType.BLOCK_PROVE:
                    fs.writeFileSync(`./BLOCK_PROVE_proofTaskDto_${proofTaskDto.index?.uuid}_proofResult_${proofTaskDto.index.blockId}_${getDateString()}.json`, JSON.stringify(proofTaskDto));
                    await proofScheduler.whenL2BlockComeback(proofTaskDto.index.blockId, flowTask.data);
                    break;
                case FlowTaskType.ROLLUP_CONTRACT_CALL:
                    fs.writeFileSync(`./ROLLUP_CONTRACT_CALL_proofTaskDto_${proofTaskDto.index?.uuid}_proofResult_${proofTaskDto.index.blockId}_${getDateString()}.json`, JSON.stringify(proofTaskDto));
                    await proofScheduler.whenL1TxComeback(proofTaskDto.index.blockId, flowTask.data);
                    break;
                default: // rid it
                    logger.info('rid FlowTask', JSON.stringify(flowTask));
                    break;
            }
        }

    } catch (error) {
        logger.error(error);
    }
    process.send!('done');
});
