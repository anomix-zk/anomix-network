
import { JoinSplitProver, JoinSplitDepositInput } from "@anomix/circuits";
import { activeMinaInstance } from '@anomix/utils';
import { ProofTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger('proof-worker');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${ProofTaskType[ProofTaskType.DEPOSIT_JOIN_SPLIT]}`:
                execCircuit(message, async () => {
                    let params = message.payload as JoinSplitDepositInput
                    return await JoinSplitProver.deposit(params)
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
        logger.info(error);
    }
}

const initWorker = async () => {
    // init 
    await activeMinaInstance();

    logger.info(`[WORKER ${process.pid}] new worker forked`);

    await JoinSplitProver.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        status: 'isReady',
        type: process.argv[0]
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};
