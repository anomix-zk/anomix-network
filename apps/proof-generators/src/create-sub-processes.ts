import os from 'os';
import cluster, { Worker } from 'cluster';
import { PublicKey, Signature, VerificationKey } from 'snarkyjs';

import { ProofPayload } from './constant';
import {
    BlockProveInput, DepositActionBatch, DepositRollupProof, DepositRollupState, InnerRollupInput, InnerRollupProof,
    JoinSplitDepositInput, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, RollupProof, WithdrawNoteWitnessData
} from "@anomix/circuits";
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "./lib/logUtils";

const logger = getLogger('create-sub-processes');

export type SubProcessCordinator = {
    workers: { worker: Worker; status: WorkerStatus }[],

    innerRollup_proveTxBatch: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    innerRollup_merge: (proofPayload1: ProofPayload<any>, proofPayload2: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    depositRollup_commitActionBatch: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    depositRollup_merge: (x: ProofPayload<any>, y: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    jointSplit_deposit: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    blockProve: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    depositContract_updateDepositState: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    rollupContract_firstWithdraw: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    rollupContract_withdraw: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>,

    rollupContract_updateRollupState: (proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>>
};

export const createSubProcesses = async (n: number) => {
    let cores = os.cpus().length;
    logger.info(`Number of CPUs is ${cores}`);
    logger.info(`Master ${process.pid} is running`);
    if (cores - 2 <= n)
        throw Error(
            `You have ${cores} cores available, but you are trying to spin up ${n} processes. Please give your CPU some room to breathe!`
        );
    let workers: { worker: Worker; status: WorkerStatus }[] = [];
    for (let i = 0; i < n; i++) {
        let worker = cluster.fork();
        workers.push({ worker, status: 'Busy' });
    }
    cluster.on('message', (worker, message, signal) => {
        message = JSON.parse(JSON.stringify(message));
        switch (message.type) {
            case 'isReady':
                workers.find(
                    (w) => w.worker.process.pid! == worker.process!.pid!
                )!.status = 'IsReady';
                break;
            default:
                break;
        }
    });
    await waitForWorkers(workers);

    return {
        workers,

        jointSplit_deposit: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {
                    const data = (proofPayload.payload as { blockId: number, data: { txId: number, data: JoinSplitDepositInput }[] }).data;
                    let sum = 0;
                    data.forEach(d => {
                        const msg1 = {
                            type: `${ProofTaskType[ProofTaskType.DEPOSIT_JOIN_SPLIT]}`,
                            payload: d.data,// ie. JoinSplitDepositInput
                        };
                        let worker: { worker: Worker, status: string } | undefined = undefined;
                        do {
                            worker = workers.find((w) => w.status == 'IsReady');
                        } while (worker === undefined);

                        workers.find(
                            (w) => w.worker.process.pid == worker!.worker.process.pid
                        )!.status = 'Busy';

                        // send for exec circuit
                        worker?.worker!.send(msg1);

                        worker?.worker!.on('message', (message: any) => {
                            workers.find(
                                (w) => w.worker.process.pid == worker!.worker.process.pid
                            )!.status = 'IsReady';

                            try {
                                d.data = message.payload as any;// replace the original to the proof result
                                sum++;
                                logger.info(`jointSplit_deposit: sum: ${sum}`);

                                if (sum + 1 == data.length) {// when the proof count is equals to the target, then send the whole results to deposit_processor
                                    // send back to deposit_processor
                                    if (sendCallBack) {
                                        sendCallBack(proofPayload.payload)
                                    }
                                    resolve({
                                        isProof: true,
                                        payload: data,
                                    });
                                }
                            } catch (error) {
                                reject(error);
                            }
                        });

                    });

                }
            );
        },

        innerRollup_proveTxBatch: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {
                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.ROLLUP_TX_BATCH]}`,
                        payload: proofPayload.payload as {
                            innerRollupInput: InnerRollupInput,
                            joinSplitProof1: JoinSplitProof,
                            joinSplitProof2: JoinSplitProof
                        },
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return InnerRollupProof.fromJSON(proofJson);
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },
        innerRollup_merge: async (x: ProofPayload<any>, y: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.ROLLUP_MERGE]}`,
                        payload: { innerRollupProof1: x.payload, innerRollupProof2: y.payload } as {
                            innerRollupProof1: InnerRollupProof,
                            innerRollupProof2: InnerRollupProof
                        },
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return InnerRollupProof.fromJSON(proofJson);
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },
        blockProve: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.BLOCK_PROVE]}`,
                        payload: { innerRollupProof1: proofPayload.payload.innerRollupProof1, innerRollupProof2: proofPayload.payload.innerRollupProof2 } as {
                            innerRollupProof1: BlockProveInput,
                            innerRollupProof2: InnerRollupProof
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return DepositRollupProof.fromJSON(proofJson);
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },
        rollupContract_updateRollupState: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${ProofTaskType[ProofTaskType.USER_FIRST_WITHDRAW]}`,
                        payload: {
                            feePayer: proofPayload.payload.feePayer,
                            innerRollupProof1: proofPayload.payload.innerRollupProof1,
                            innerRollupProof2: proofPayload.payload.innerRollupProof2
                        } as {
                            feePayer: PublicKey,
                            innerRollupProof1: RollupProof,
                            innerRollupProof2: Signature
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return proofJson;
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },

        depositRollup_commitActionBatch: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {// TODO!
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.DEPOSIT_BATCH]}`,
                        payload: { depositActionBatch: proofPayload.payload.depositActionBatch, depositRollupState: proofPayload.payload.depositRollupState } as {
                            depositRollupState: DepositRollupState,
                            depositActionBatch: DepositActionBatch
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return DepositRollupProof.fromJSON(proofJson);
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },
        depositRollup_merge: async (x: ProofPayload<any>, y: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.DEPOSIT_MERGE]}`,
                        payload: { DepositRollupProof1: x.payload, DepositRollupProof2: y.payload } as {
                            DepositRollupProof1: DepositRollupProof,
                            DepositRollupProof2: DepositRollupProof
                        },
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return DepositRollupProof.fromJSON(proofJson);
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },
        depositContract_updateDepositState: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.DEPOSIT_UPDATESTATE]}`,
                        payload: {
                            feePayer: proofPayload.payload.feePayer,
                            depositRollupProof: proofPayload.payload.depositRollupProof
                        } as {
                            feePayer: PublicKey,
                            depositRollupProof: DepositRollupProof
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return proofJson;
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },

        rollupContract_firstWithdraw: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${ProofTaskType[ProofTaskType.USER_FIRST_WITHDRAW]}`,
                        payload: {
                            feePayer: proofPayload.payload.feePayer, verificationKey: proofPayload.payload.verificationKey,
                            withdrawNoteWitnessData: proofPayload.payload.withdrawNoteWitnessData,
                            oldNullWitness: proofPayload.payload.oldNullWitness
                        } as {
                            feePayer: PublicKey,
                            verificationKey: VerificationKey,
                            withdrawNoteWitnessData: WithdrawNoteWitnessData,
                            lowLeafWitness: LowLeafWitnessData,
                            oldNullWitness: NullifierMerkleWitness
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return proofJson;
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);

                }
            );
        },
        rollupContract_withdraw: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${ProofTaskType[ProofTaskType.USER_WITHDRAW]}`,
                        payload: {
                            feePayer: proofPayload.payload.feePayer,
                            withdrawNoteWitnessData: proofPayload.payload.withdrawNoteWitnessData,
                            oldNullWitness: proofPayload.payload.oldNullWitness
                        } as {
                            feePayer: PublicKey,
                            withdrawNoteWitnessData: WithdrawNoteWitnessData,
                            lowLeafWitness: LowLeafWitnessData,
                            oldNullWitness: NullifierMerkleWitness
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return proofJson;
                    }

                    reqProofGen(workers, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },

    } as SubProcessCordinator;
};

type WorkerStatus = 'IsReady' | 'Busy';

const waitForWorkers = async (
    workers: { worker: Worker; status: WorkerStatus }[]
): Promise<void> => {
    let allReady = false;
    const executePoll = async (
        resolve: () => void,
        reject: (err: Error) => void | Error
    ) => {
        workers.forEach((w) =>
            w.status == 'IsReady' ? (allReady = true) : (allReady = false)
        );
        if (allReady) {
            return resolve();
        }
        setTimeout(executePoll, 1000, resolve, reject);
    };
    return new Promise(executePoll);
};

function reqProofGen(workers: { worker: Worker; status: WorkerStatus; }[], msg: { type: string; payload: any; }, fromJsonFn, resolve, reject: (err: any) => any | any, sendCallBack?: any) {
    let worker: { worker: Worker, status: string } | undefined = undefined;
    do {
        worker = workers.find((w) => w.status == 'IsReady');
    } while (worker === undefined);

    workers.find(
        (w) => w.worker.process.pid == worker!.worker.process.pid
    )!.status = 'Busy';

    worker?.worker!.send(msg);

    worker?.worker!.on('message', (message: any) => {
        workers.find(
            (w) => w.worker.process.pid == worker!.worker.process.pid
        )!.status = 'IsReady';
        try {
            let proofJson = message.payload;
            let p = fromJsonFn(proofJson);
            if (sendCallBack) {
                sendCallBack(p);
            }

            resolve({
                isProof: true,
                payload: p,
            });
        } catch (error) {
            reject(error);
        }
    });
}
