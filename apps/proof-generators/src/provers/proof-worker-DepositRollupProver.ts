
import { DepositRollupProver, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance } from '@anomix/utils';
import { FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";
import { commitActionBatch, merge } from "./circuits/deposit_rollup_prover";
import fs from "fs";

const logger = getLogger('pWorker-DepositRollupProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.DEPOSIT_BATCH]}`:
                await execCircuit(message, async () => {
                    let params = {
                        depositRollupState: new DepositRollupState(DepositRollupState.fromJSON(message.payload.depositRollupState)),
                        depositActionBatch: new DepositActionBatch(DepositActionBatch.fromJSON(message.payload.depositActionBatch))
                    };

                    logger.info(`currently process [params.depositRollupState.currentActionsHash: ${params.depositRollupState.currentActionsHash}, params.depositRollupState.currentIndex: ${params.depositRollupState.currentIndex}]`);
                    logger.info(`currently commitActionBatch [params.depositActionBatch.actions: ${JSON.stringify(params.depositActionBatch.actions)}]`);

                    // for test before
                    commitActionBatch(params.depositRollupState, params.depositActionBatch)

                    logger.info(`exec 'commitActionBatch' outside circuit smoothly`);

                    return await DepositRollupProver.commitActionBatch(params.depositRollupState, params.depositActionBatch)
                });
                break;

            case `${FlowTaskType[FlowTaskType.DEPOSIT_MERGE]}`:
                await execCircuit(message, async () => {
                    let params = {
                        depositRollupProof1: DepositRollupProof.fromJSON(message.payload.depositRollupProof1),
                        depositRollupProof2: DepositRollupProof.fromJSON(message.payload.depositRollupProof2)
                    }

                    const depositRollupProof1 = params.depositRollupProof1;
                    const depositRollupProof2 = params.depositRollupProof2;

                    logger.info(`currently process [depositRollupProof1.publicOutput.source: {currentActionsHash: ${depositRollupProof1.publicOutput.source.currentActionsHash}, currentIndex: ${depositRollupProof1.publicOutput.source.currentIndex}}]`);
                    logger.info(`currently process [depositRollupProof1.publicOutput.target: {currentActionsHash: ${depositRollupProof1.publicOutput.target.currentActionsHash}, currentIndex: ${depositRollupProof1.publicOutput.target.currentIndex}}]`);

                    logger.info(`currently process [depositRollupProof2.publicOutput.source: {currentActionsHash: ${depositRollupProof2.publicOutput.source.currentActionsHash}, currentIndex: ${depositRollupProof2.publicOutput.source.currentIndex}}]`);
                    logger.info(`currently process [depositRollupProof2.publicOutput.target: {currentActionsHash: ${depositRollupProof2.publicOutput.target.currentActionsHash}, currentIndex: ${depositRollupProof2.publicOutput.target.currentIndex}}]`);

                    merge(depositRollupProof1, depositRollupProof2);

                    logger.info(`exec 'merge' outside circuit smoothly`);

                    return await DepositRollupProver.merge(depositRollupProof1, depositRollupProof2)
                });
                break;

            default:
                throw Error(`Unknown message ${message}`);
        }
        logger.info(`[WORKER ${process.pid}] completed ${message.type}`);
    });
}

const execCircuit = async (message: any, func: () => Promise<any>) => {
    try {
        console.time(`${message.type} exec`);

        // exec circuit...
        let proof = await func();

        console.timeEnd(`${message.type} exec`);

        logger.info(JSON.stringify(proof.toJSON()));

        fs.writeFileSync(`./${message.type}_proofJson_${new Date().getTime()}.txt`, JSON.stringify(proof.toJSON()));

        process.send!({
            type: 'done',
            messageType: message.type,
            id: process.pid,
            payload: {
                isProof: true,
                payload: proof.toJSON(),
            },
        });
    } catch (error) {
        logger.error(error);

        console.error(error);

        process.send!({// must notify main process to change worker's status to 'isReady'
            type: 'error',
            messageType: message.type,
            id: process.pid,
            payload: {},
        });
    }
}

const initWorker = async () => {
    // init 
    await activeMinaInstance();

    process.send!({
        type: 'online',
    });

    logger.info(`[WORKER ${process.pid}] new worker forked`);

    await DepositRollupProver.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
