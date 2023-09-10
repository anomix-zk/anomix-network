
import { JoinSplitProver, JoinSplitDepositInput } from "@anomix/circuits";
import { activeMinaInstance } from '@anomix/utils';
import { ProofTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";
import { deposit } from "./circuits/join-split-prover";

const logger = getLogger('pWorker-JoinSplitProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${ProofTaskType[ProofTaskType.DEPOSIT_JOIN_SPLIT]}`:
                await execCircuit(message, async () => {
                    let params = new JoinSplitDepositInput(JoinSplitDepositInput.fromJSON(message.payload))

                    let proof = deposit(params);

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

        logger.info(JSON.stringify(proof.toJSON()));

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

    await JoinSplitProver.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady'
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
