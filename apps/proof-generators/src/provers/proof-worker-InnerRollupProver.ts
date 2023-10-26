import { Field, PublicKey, Proof, Mina, Signature, VerificationKey } from 'o1js';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, InnerRollupInput, JoinSplitProof, InnerRollupOutput, InnerRollupProof, BlockProveInput, JoinSplitDepositInput, RollupProof, LowLeafWitnessData, NullifierMerkleWitness, WithdrawNoteWitnessData, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";
import { proveTxBatch, merge } from './circuits/inner_rollup_prover';

const logger = getLogger('pWorker-InnerRollupProver');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.ROLLUP_TX_BATCH]}`:
                await execCircuit(message, async () => {
                    const params = {
                        innerRollupInput: new InnerRollupInput(InnerRollupInput.fromJSON(JSON.parse(message.payload.innerRollupInput))),// TODO no need JSON.parse in later version.
                        joinSplitProof1: JoinSplitProof.fromJSON(JSON.parse(message.payload.joinSplitProof1)),// TODO no need JSON.parse in later version.
                        joinSplitProof2: JoinSplitProof.fromJSON(JSON.parse(message.payload.joinSplitProof2)) // TODO no need JSON.parse in later version.
                    }

                    logger.info(`currently process [innerRollupInput.dataStartIndex: ${params.innerRollupInput.dataStartIndex}]`);
                    logger.info(`currently batch [joinSplitProof1.outputNoteCommitment1: ${params.joinSplitProof1.publicOutput.outputNoteCommitment1}, joinSplitProof1.outputNoteCommitment2: ${params.joinSplitProof1.publicOutput.outputNoteCommitment2}]`);
                    logger.info(`currently batch [joinSplitProof2.outputNoteCommitment1: ${params.joinSplitProof2.publicOutput.outputNoteCommitment1}, joinSplitProof2.outputNoteCommitment2: ${params.joinSplitProof2.publicOutput.outputNoteCommitment2}]`);

                    proveTxBatch(params.innerRollupInput, params.joinSplitProof1, params.joinSplitProof2);
                    logger.info(`exec 'proveTxBatch' outside circuit smoothly`);

                    const proofRs = await InnerRollupProver.proveTxBatch(params.innerRollupInput, params.joinSplitProof1, params.joinSplitProof2);
                    logger.info(`exec 'proveTxBatch' inside circuit: done`);

                    return proofRs;
                });
                break;

            case `${FlowTaskType[FlowTaskType.ROLLUP_MERGE]}`:
                await execCircuit(message, async () => {
                    let params = {
                        innerRollupProof1: InnerRollupProof.fromJSON(message.payload.innerRollupProof1),
                        innerRollupProof2: InnerRollupProof.fromJSON(message.payload.innerRollupProof2)
                    }

                    logger.info(`currently merge [innerRollupProof1.publicOutput.oldDataRoot: ${params.innerRollupProof1.publicOutput.oldDataRoot}, innerRollupProof2.publicOutput.oldDataRoot: ${params.innerRollupProof2.publicOutput.oldDataRoot}]`);

                    const proof = merge(params.innerRollupProof1, params.innerRollupProof2);
                    logger.info(`exec 'merge' outside circuit smoothly`);

                    const proofRs = await InnerRollupProver.merge(params.innerRollupProof1, params.innerRollupProof2);
                    logger.info(`exec 'merge' inside circuit: done`);

                    return proofRs;
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

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
