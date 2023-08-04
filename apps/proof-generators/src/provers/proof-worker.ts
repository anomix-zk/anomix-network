import { FlowTaskType } from '@/constant';
import { Field, PublicKey, Proof, Mina, Signature, VerificationKey } from 'snarkyjs';
import config from "../lib/config";

import { InnerRollupProver, JoinSplitProver, BlockProver, DepositRollupProver, AnomixRollupContract, WithdrawAccount, AnomixEntryContract, InnerRollupInput, JoinSplitProof, InnerRollupOutput, InnerRollupProof, BlockProveInput, JoinSplitDepositInput, RollupProof, LowLeafWitnessData, NullifierMerkleWitness, WithdrawNoteWitnessData, DepositActionBatch, DepositRollupState, DepositRollupProof } from "@anomix/circuits";
import { activeMinaInstance, syncAcctInfo } from '@anomix/utils';
import { ProofTaskType } from '@anomix/types';

export { initWorker };

function processMsgFromMaster() {
    process.on('message', async (message: { type: string; payload: any }) => {

        console.log(`[WORKER ${process.pid}] running ${message.type}`);

        switch (message.type) {
            case `${ProofTaskType[ProofTaskType.DEPOSIT_BATCH]}`:
                execCircuit(message, async () => {
                    let params = message.payload as {
                        depositRollupState: DepositRollupState,
                        depositActionBatch: DepositActionBatch
                    }
                    return await DepositRollupProver.commitActionBatch(params.depositRollupState, params.depositActionBatch)
                });
                break;


            case `${ProofTaskType[ProofTaskType.DEPOSIT_MERGE]}`:
                execCircuit(message, async () => {
                    let params = message.payload as {
                        DepositRollupProof1: DepositRollupProof,
                        DepositRollupProof2: DepositRollupProof
                    }
                    return await DepositRollupProver.merge(params.DepositRollupProof1, params.DepositRollupProof2)
                });
                break;

            case `${FlowTaskType[FlowTaskType.ROLLUP_TX_MERGE]}`:
                execCircuit(message, async () => {
                    const params = message.payload as {
                        innerRollupInput: InnerRollupInput,
                        joinSplitProof1: JoinSplitProof,
                        joinSplitProof2: JoinSplitProof
                    }
                    return await InnerRollupProver.proveTxBatch(params.innerRollupInput, params.joinSplitProof1, params.joinSplitProof2);
                });
                break;

            case `${FlowTaskType[FlowTaskType.ROLLUP_MERGE]}`:
                execCircuit(message, async () => {
                    let params = message.payload as {
                        innerRollupProof1: InnerRollupProof,
                        innerRollupProof2: InnerRollupProof
                    }
                    return await InnerRollupProver.merge(params.innerRollupProof1, params.innerRollupProof2);
                });
                break;

            case `${FlowTaskType[FlowTaskType.BLOCK_PROVE]}`:
                execCircuit(message, async () => {
                    let params = message.payload as {
                        innerRollupProof1: BlockProveInput,
                        innerRollupProof2: InnerRollupProof
                    }
                    return await BlockProver.prove(params.innerRollupProof1, params.innerRollupProof2);
                });
                break;


            case `${FlowTaskType[FlowTaskType.DEPOSIT_JOIN_SPLIT]}`:
                execCircuit(message, async () => {
                    let params = message.payload as JoinSplitDepositInput
                    return await JoinSplitProver.deposit(params)
                });
                break;

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

            case `${ProofTaskType[ProofTaskType.DEPOSIT_UPDATESTATE]}`:
                execCircuit(message, async () => {
                    const params = message.payload as {
                        feePayer: PublicKey,
                        depositRollupProof: DepositRollupProof
                    }

                    const addr = PublicKey.fromBase58(config.entryContractAddress);
                    await syncAcctInfo(addr);// fetch account.
                    const entryContract = new AnomixEntryContract(addr);
                    let tx = await Mina.transaction(params.feePayer, () => {
                        entryContract.updateDepositState(params.depositRollupProof);
                    });

                    return tx;
                });
                break;

            default:
                throw Error(`Unknown message ${message}`);
        }
        console.log(`[WORKER ${process.pid}] completed ${message.type}`);
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
        console.log(error);
    }
}

const initWorker = async () => {
    // init 
    await activeMinaInstance();

    console.log(`[WORKER ${process.pid}] new worker forked`);

    await InnerRollupProver.compile();
    await JoinSplitProver.compile();
    await BlockProver.compile();
    await DepositRollupProver.compile();
    await WithdrawAccount.compile();

    await AnomixRollupContract.compile();
    await AnomixEntryContract.compile();

    // recieve message from main process...
    processMsgFromMaster();

    process.send!({
        type: 'isReady',
    });
    console.log(`[WORKER ${process.pid}] new worker ready`);
};
