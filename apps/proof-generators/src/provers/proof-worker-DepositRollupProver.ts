
import { DepositRollupProver, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance } from '@anomix/utils';
import { FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger('pWorker-DepositRollupProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.DEPOSIT_BATCH]}`:
                await execCircuit(message, async () => {
                    let params = message.payload as {
                        depositRollupState: DepositRollupState,
                        depositActionBatch: DepositActionBatch
                    }
                    return await DepositRollupProver.commitActionBatch(params.depositRollupState, params.depositActionBatch)
                });
                break;
            case `${FlowTaskType[FlowTaskType.DEPOSIT_MERGE]}`:
                await execCircuit(message, async () => {
                    let params = message.payload as {
                        DepositRollupProof1: DepositRollupProof,
                        DepositRollupProof2: DepositRollupProof
                    }
                    return await DepositRollupProver.merge(params.DepositRollupProof1, params.DepositRollupProof2)
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

        process.send!({
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

    // await DepositRollupProver.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
