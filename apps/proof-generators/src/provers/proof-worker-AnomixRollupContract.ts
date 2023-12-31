import { Field, PublicKey, Mina, Signature, fetchAccount } from 'o1js';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, RollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger('pWorker-AnomixRollupContract');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.ROLLUP_CONTRACT_CALL]}`:
                await execCircuit(message, async () => {
                    let params = {
                        fee: message.payload.fee,
                        feePayer: PublicKey.fromBase58(message.payload.feePayer),
                        proof: RollupProof.fromJSON(JSON.parse(message.payload.proof)),
                        operatorSign: Signature.fromJSON(message.payload.operatorSign),
                        entryDepositRoot: Field(message.payload.entryDepositRoot)
                    }

                    const addr = PublicKey.fromBase58(config.rollupContractAddress);
                    await syncAcctInfo(addr);// fetch account.
                    const rollupContract = new AnomixRollupContract(addr);

                    logger.info(`blockHash: ${params.proof.publicOutput.blockHash}`);

                    logger.info(`dataRoot0: ${params.proof.publicOutput.stateTransition.source.dataRoot}`);
                    logger.info(`dataRootsRoot0: ${params.proof.publicOutput.stateTransition.source.dataRootsRoot}`);
                    logger.info(`depositStartIndex0: ${params.proof.publicOutput.stateTransition.source.depositStartIndex}`);
                    logger.info(`nullifierRoot0: ${params.proof.publicOutput.stateTransition.source.nullifierRoot}`);

                    logger.info(`dataRoot1: ${params.proof.publicOutput.stateTransition.target.dataRoot}`);
                    logger.info(`dataRootsRoot1: ${params.proof.publicOutput.stateTransition.target.dataRootsRoot}`);
                    logger.info(`depositStartIndex1: ${params.proof.publicOutput.stateTransition.target.depositStartIndex}`);
                    logger.info(`nullifierRoot1: ${params.proof.publicOutput.stateTransition.target.nullifierRoot}`);

                    logger.info(`depositRoot0: ${params.proof.publicOutput.depositRoot}`);
                    logger.info(`current AnomixEntryContract.depositRoot: ${params.entryDepositRoot.toString()}`);

                    let tx = await Mina.transaction({ sender: params.feePayer, fee: params.fee }, () => {
                        rollupContract.updateRollupState(params.proof, params.operatorSign, params.entryDepositRoot)
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

    await JoinSplitProver.compile();
    await InnerRollupProver.compile();
    await BlockProver.compile();
    await WithdrawAccount.compile();
    AnomixRollupContract.entryContractAddress = PublicKey.fromBase58(config.entryContractAddress);
    await AnomixRollupContract.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};

await initWorker();
