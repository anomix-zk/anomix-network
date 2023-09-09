import { Field, PublicKey, Proof, Mina, Signature, VerificationKey } from 'snarkyjs';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, InnerRollupInput, JoinSplitProof, InnerRollupOutput, InnerRollupProof, BlockProveInput, JoinSplitDepositInput, RollupProof, LowLeafWitnessData, NullifierMerkleWitness, WithdrawNoteWitnessData, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger('pWorker-BlockProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.BLOCK_PROVE]}`:
                await execCircuit(message, async () => {
                    let params = {
                        blockProveInput: new BlockProveInput(BlockProveInput.fromJSON(message.payload.blockProveInput)),
                        innerRollupProof: InnerRollupProof.fromJSON(message.payload.innerRollupProof)
                    }
                    return await BlockProver.prove(params.blockProveInput, params.innerRollupProof);
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
    await BlockProver.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
