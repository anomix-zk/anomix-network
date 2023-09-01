import { Field, PublicKey, Proof, Mina, Signature, VerificationKey } from 'snarkyjs';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, InnerRollupInput, JoinSplitProof, InnerRollupOutput, InnerRollupProof, BlockProveInput, JoinSplitDepositInput, RollupProof, LowLeafWitnessData, NullifierMerkleWitness, WithdrawNoteWitnessData, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger('pWorker-InnerRollupProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.ROLLUP_TX_BATCH]}`:
                execCircuit(message, async () => {
                    const params = {
                        innerRollupInput: new InnerRollupInput(InnerRollupInput.fromJSON(message.payload.innerRollupInput)),
                        joinSplitProof1: JoinSplitProof.fromJSON(message.payload.joinSplitProof1),
                        joinSplitProof2: JoinSplitProof.fromJSON(message.payload.joinSplitProof2)
                    }

                    return await InnerRollupProver.proveTxBatch(params.innerRollupInput, params.joinSplitProof1, params.joinSplitProof2);
                });
                break;

            case `${FlowTaskType[FlowTaskType.ROLLUP_MERGE]}`:
                execCircuit(message, async () => {
                    let params = {
                        innerRollupProof1: InnerRollupProof.fromJSON(message.payload.innerRollupProof1),
                        innerRollupProof2: InnerRollupProof.fromJSON(message.payload.innerRollupProof2)
                    }
                    return await InnerRollupProver.merge(params.innerRollupProof1, params.innerRollupProof2);
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

    await JoinSplitProver.compile();
    await InnerRollupProver.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
