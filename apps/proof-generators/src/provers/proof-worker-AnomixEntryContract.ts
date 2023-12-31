import { PublicKey, Mina } from 'o1js';
import config from "../lib/config";

import { DepositRollupProver, AnomixEntryContract, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger(`pWorker-AnomixEntryContract`);

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.DEPOSIT_UPDATESTATE]}`:
                await execCircuit(message, async () => {
                    const params = {
                        feePayer: PublicKey.fromBase58(message.payload.feePayer),
                        fee: message.payload.fee,
                        depositRollupProof: DepositRollupProof.fromJSON(message.payload.depositRollupProof)
                    }

                    logger.info(`currentActionsHash0: ${params.depositRollupProof.publicOutput.source.currentActionsHash}`);
                    logger.info(`currentIndex0: ${params.depositRollupProof.publicOutput.source.currentIndex}`);
                    logger.info(`depositRoot0: ${params.depositRollupProof.publicOutput.source.depositRoot}`);

                    logger.info(`currentActionsHash1: ${params.depositRollupProof.publicOutput.target.currentActionsHash}`);
                    logger.info(`currentIndex1: ${params.depositRollupProof.publicOutput.target.currentIndex}`);
                    logger.info(`depositRoot1: ${params.depositRollupProof.publicOutput.target.depositRoot}`);

                    const addr = PublicKey.fromBase58(config.entryContractAddress);
                    await syncAcctInfo(addr);// fetch account.
                    const entryContract = new AnomixEntryContract(addr);

                    let tx = await Mina.transaction({ sender: params.feePayer, fee: params.fee }, () => {
                        entryContract.updateDepositState(params.depositRollupProof);
                    });
                    await tx.prove();

                    return tx;
                });
                break;

            default:
                throw Error(`Unknown message ${message}`);
        }
        logger.info(`[WORKER ${process.pid}] completed ${message.type}`);

        process.exit(0);
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

    await DepositRollupProver.compile();
    await AnomixEntryContract.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
