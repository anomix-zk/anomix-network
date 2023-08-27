import { Field, PublicKey, Proof, Mina, Signature, VerificationKey } from 'snarkyjs';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, InnerRollupInput, JoinSplitProof, InnerRollupOutput, InnerRollupProof, BlockProveInput, JoinSplitDepositInput, RollupProof, LowLeafWitnessData, NullifierMerkleWitness, WithdrawNoteWitnessData, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "../lib/logUtils";

const logger = getLogger('proof-worker');

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        logger.info(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {

            case `${FlowTaskType[FlowTaskType.ROLLUP_CONTRACT_CALL]}`:
                execCircuit(message, async () => {
                    let params = message.payload as {
                        feePayer: PublicKey,
                        innerRollupProof1: RollupProof,
                        innerRollupProof2: Signature
                    }

                    const addr = PublicKey.fromBase58(config.rollupContractAddress);
                    await syncAcctInfo(addr);// fetch account.
                    const rollupContract = new AnomixRollupContract(addr);
                    let tx = await Mina.transaction(params.feePayer, () => {
                        rollupContract.updateRollupState(params.innerRollupProof1, params.innerRollupProof2)
                    });
                    return tx;
                });
                break;



            case `${ProofTaskType[ProofTaskType.USER_FIRST_WITHDRAW]}`:
                execCircuit(message, async () => {
                    const params = message.payload as {
                        feePayer: PublicKey,
                        verificationKey: VerificationKey,
                        withdrawNoteWitnessData: WithdrawNoteWitnessData,
                        lowLeafWitness: LowLeafWitnessData,
                        oldNullWitness: NullifierMerkleWitness
                    }

                    const addr = PublicKey.fromBase58(config.rollupContractAddress);
                    await syncAcctInfo(addr);// fetch account.
                    const rollupContract = new AnomixRollupContract(addr);
                    let tx = await Mina.transaction(params.feePayer, () => {
                        rollupContract.firstWithdraw(params.verificationKey, params.withdrawNoteWitnessData, params.lowLeafWitness, params.oldNullWitness)
                    });

                    return tx;
                });
                break;
            case `${ProofTaskType[ProofTaskType.USER_WITHDRAW]}`:
                execCircuit(message, async () => {
                    const params = message.payload as {
                        feePayer: PublicKey,
                        verificationKey: VerificationKey,
                        withdrawNoteWitnessData: WithdrawNoteWitnessData,
                        lowLeafWitness: LowLeafWitnessData,
                        oldNullWitness: NullifierMerkleWitness
                    }

                    const addr = PublicKey.fromBase58(config.rollupContractAddress);
                    await syncAcctInfo(addr);// fetch account.
                    const rollupContract = new AnomixRollupContract(addr);
                    let tx = await Mina.transaction(params.feePayer, () => {
                        rollupContract.withdraw(params.withdrawNoteWitnessData, params.lowLeafWitness, params.oldNullWitness)
                    });

                    return tx;
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

    await DepositRollupProver.compile();
    await AnomixEntryContract.compile();

    await JoinSplitProver.compile();
    await InnerRollupProver.compile();
    await BlockProver.compile();
    await WithdrawAccount.compile();
    await AnomixRollupContract.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    logger.info(`[WORKER ${process.pid}] new worker ready`);
};
