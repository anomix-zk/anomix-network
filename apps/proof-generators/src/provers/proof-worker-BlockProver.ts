import { Field, PublicKey, Proof, Mina, Signature, VerificationKey } from 'o1js';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, InnerRollupInput, JoinSplitProof, InnerRollupOutput, InnerRollupProof, BlockProveInput, JoinSplitDepositInput, RollupProof, LowLeafWitnessData, NullifierMerkleWitness, WithdrawNoteWitnessData, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";
import { prove } from "./circuits/block_prover";

const logger = getLogger('pWorker-BlockProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.BLOCK_PROVE]}`:
                await execCircuit(message, async () => {
                    // comprising code! due to PublicKey.fromBase58(PubicKey.empty().toBase58()) will fail.
                    message.payload.blockProveInput.txFeeReceiverNote.creatorPk = message.payload.blockProveInput.txFeeReceiverNote.ownerPk;
                    const blockProveInput = new BlockProveInput(BlockProveInput.fromJSON(message.payload.blockProveInput));
                    blockProveInput.txFeeReceiverNote.creatorPk = PublicKey.empty();
                    let params = {
                        blockProveInput,
                        innerRollupProof: InnerRollupProof.fromJSON(message.payload.innerRollupProof)
                    }

                    logger.info(`currently process blockProveInput.dataStartIndex: ${params.blockProveInput.dataStartIndex}`);

                    await prove(params.blockProveInput, params.innerRollupProof);
                    logger.info(`exec 'BlockProver.prove' outside circuit smoothly`);

                    const proof = await BlockProver.prove(params.blockProveInput, params.innerRollupProof);
                    logger.info(`exec 'BlockProver.prove' inside circuit: done`);

                    return proof;
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

        // when meet errors, probably it's about out of wasm32 memory, so restart the process
        process.exit(0);
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
