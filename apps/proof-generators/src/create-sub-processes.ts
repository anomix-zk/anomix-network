import os from 'os';
import cluster from 'cluster';
import { PublicKey, Signature, VerificationKey, Field } from 'o1js';
import cp, { ChildProcess, ChildProcess as Worker } from "child_process";

import { ProofPayload } from './constant';
import {
    BlockProveInput, BlockProveOutput, DepositActionBatch, DepositRollupProof, DepositRollupState, InnerRollupInput, InnerRollupProof,
    JoinSplitDepositInput, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, RollupProof, WithdrawNoteWitnessData
} from "@anomix/circuits";
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "./lib/logUtils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import config from './lib/config';


const logger = getLogger('create-sub-processes');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type SubProcessCordinator = {
    workerMap: Map<string, { worker: Worker; status: WorkerStatus; type: string }[]>,

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

type WorkerStatus = 'IsReady' | 'Busy';

const CircuitName_DepositRollupProver = 'DepositRollupProver';
const CircuitName_AnomixEntryContract = 'AnomixEntryContract';
const CircuitName_JoinSplitProver = 'JoinSplitProver';
const CircuitName_InnerRollupProver = 'InnerRollupProver';
const CircuitName_BlockProver = 'BlockProver';
const CircuitName_AnomixRollupContract = 'AnomixRollupContract';

const cnt_DepositRollupProver = config.cnt_DepositRollupProver;
const cnt_AnomixEntryContract = config.cnt_AnomixEntryContract;
const cnt_JoinSplitProver = config.cnt_JoinSplitProver;
const cnt_InnerRollupProver = config.cnt_InnerRollupProver;
const cnt_BlockProver = config.cnt_BlockProver;
const cnt_AnomixRollupContract = config.cnt_AnomixRollupContract;

/* 
const cnt_DepositRollupProver = Math.floor((3 / 16) * cores) == 0 ? 1 : Math.floor((3 / 16) * cores);
const cnt_AnomixEntryContract = 1;// consider L1Tx execution one by one
const cnt_JoinSplitProver = Math.floor((3 / 16) * cores) == 0 ? 1 : Math.floor((3 / 16) * cores);
const cnt_InnerRollupProver = Math.floor((3 / 16) * cores) == 0 ? 1 : Math.floor((3 / 16) * cores);
const cnt_BlockProver = Math.floor((3 / 16) * cores) == 0 ? 1 : Math.floor((3 / 16) * cores);
const cnt_AnomixRollupContract = Math.floor((3 / 16) * cores) == 0 ? 1 : Math.floor((3 / 16) * cores);// consider withdrawal scene in parallel
*/

let rollupContractCallTimes = 0;
let entryContractCallTimes = 0;

export const createSubProcesses = async () => {
    let cores = os.cpus().length - 2;
    logger.info(`Number of CPUs is ${cores}`);
    logger.info(`Master ${process.pid} is running`);

    let workerMap = new Map<string, { worker: Worker, status: WorkerStatus, type: string }[]>([
        [CircuitName_DepositRollupProver, []],
        [CircuitName_AnomixEntryContract, []],
        [CircuitName_JoinSplitProver, []],
        [CircuitName_InnerRollupProver, []],
        [CircuitName_BlockProver, []],
        [CircuitName_AnomixRollupContract, []]
    ]);

    const createCircuitProcessor = (proverCnt: number, circuitName: string) => {
        const createFn = (proverCnt: number, circuitName: string, index: number) => {
            let worker = cp.fork(__dirname.concat('/provers/proof-worker-').concat(circuitName).concat('.js'), [circuitName]);

            let workerEntity: { worker: Worker, status: WorkerStatus, type: string } = { worker, status: 'Busy', type: circuitName };
            worker.on('message', (message: { type: string }) => {// change to 'IsReady'
                message = JSON.parse(JSON.stringify(message));
                switch (message.type) {
                    case 'online':
                        workerMap.get(circuitName)![index] = workerEntity;
                        break;
                    case 'isReady':
                        workerEntity.status = 'IsReady';
                        break;
                    default:
                        break;
                }
            });
            worker.on('exit', (exitCode: number) => {
                logger.info(`${circuitName} worker exited, exitCode:${exitCode}`);

                const index = workerMap.get(circuitName)!.findIndex((t, i) => {
                    return t.worker == worker;
                });
                // workerMap.get(circuitName)!.splice(index, 1);
                // create a new one again at the same position
                createFn(proverCnt, circuitName, index);
            });

            worker.on('error', (exitCode: number) => {
                logger.info(`${circuitName} worker error!`);
            });
        }

        for (let index = 0; index < proverCnt; index++) {
            createFn(proverCnt, circuitName, index);
        }
    }

        createCircuitProcessor(cnt_DepositRollupProver, CircuitName_DepositRollupProver);

    createCircuitProcessor(cnt_AnomixEntryContract, CircuitName_AnomixEntryContract);

    createCircuitProcessor(cnt_JoinSplitProver, CircuitName_JoinSplitProver);

    createCircuitProcessor(cnt_InnerRollupProver, CircuitName_InnerRollupProver);

    createCircuitProcessor(cnt_BlockProver, CircuitName_BlockProver);

    createCircuitProcessor(cnt_AnomixRollupContract, CircuitName_AnomixRollupContract);
    
    await waitForAllWorkersReady(workerMap);

    return {
        workerMap,

        jointSplit_deposit: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {
                    const data = (proofPayload.payload as {
                        blockId: number,
                        data: {
                            txId: string,
                            data: string //???
                        }[]
                    }).data;

                    const workers = workerMap.get(CircuitName_JoinSplitProver)!;
                    let sum = 0;
                    data.forEach(d => {
                        const msg1 = {
                            type: `${ProofTaskType[ProofTaskType.DEPOSIT_JOIN_SPLIT]}`,
                            payload: d.data,// ie. JoinSplitDepositInput
                        };

                        // never await this promise
                        new Promise((s, j) => {
                            getFreeWorker(workers, s, j);

                        }).then(workerEntity => {
                            let worker = workerEntity as { worker: Worker, status: WorkerStatus, type: string };

                            const handler = (message: any) => {
                                if (message.type == 'error') {// when meet errors (it's wasm32memory issue at great probability), defaultly restart the childProcess
                                    return;
                                }
                                workerMap.get(CircuitName_JoinSplitProver)!.find(
                                    // (w) => w.worker.process.pid == worker!.worker.process.pid
                                    (w) => w.worker.pid == worker!.worker.pid
                                )!.status = 'IsReady'
                                worker.worker!.removeListener('message', handler);// must rm it here to avoid listener accumulation.

                                if (message.type == 'done') {
                                    try {

                                        d.data = message.payload.payload as any;// replace the original to the proof result

                                        sum++;
                                        logger.info(`jointSplit_deposit: sum: ${sum}`);

                                        if (sum == data.length) {// when the proof count is equals to the target, then send the whole results to deposit_processor
                                            // send back to deposit_processor
                                            if (sendCallBack) {
                                                sendCallBack(proofPayload.payload)
                                                sum = 0;
                                            }
                                            resolve({
                                                isProof: true,
                                                payload: data,
                                            });

                                        }
                                    } catch (error) {
                                        reject(error);
                                    }
                                }

                            };

                            worker?.worker!.on('message', handler);

                            // send for exec circuit
                            worker?.worker!.send(msg1);
                        })


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
                            innerRollupInput: string,
                            joinSplitProof1: string,
                            joinSplitProof2: string
                        },
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return InnerRollupProof.fromJSON(proofJson);
                    }

                    generateProof(workerMap.get(CircuitName_InnerRollupProver)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            )/* .catch(e => {
                console.error(e);
            }) */;
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

                    generateProof(workerMap.get(CircuitName_InnerRollupProver)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            )/* .catch(e => {
                console.error(e);
            }) */;
        },
        blockProve: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.BLOCK_PROVE]}`,
                        payload: { blockProveInput: proofPayload.payload.blockProveInput, innerRollupProof: proofPayload.payload.innerRollupProof } as {
                            blockProveInput: BlockProveInput,
                            innerRollupProof: InnerRollupProof
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return RollupProof.fromJSON(proofJson);
                    }

                    generateProof(workerMap.get(CircuitName_BlockProver)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            ).catch(e => {
                console.error(e);
            });
        },
        rollupContract_updateRollupState: async (proofPayload: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {

                    const msg = {
                        type: `${FlowTaskType[FlowTaskType.ROLLUP_CONTRACT_CALL]}`,
                        payload: {
                            fee: proofPayload.payload.fee,
                            feePayer: proofPayload.payload.feePayer,
                            proof: proofPayload.payload.proof,
                            operatorSign: proofPayload.payload.operatorSign,
                            entryDepositRoot: proofPayload.payload.entryDepositRoot
                        } as {
                            fee: number,
                            feePayer: string,
                            proof: string,
                            operatorSign: any
                            entryDepositRoot: string
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return proofJson;
                    }

                    generateProof(workerMap.get(CircuitName_AnomixRollupContract)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            ).catch(e => {
                console.error(e);
            });
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

                    generateProof(workerMap.get(CircuitName_DepositRollupProver)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            ).catch(e => {
                console.error(e);
            });
        },
        depositRollup_merge: async (x: ProofPayload<any>, y: ProofPayload<any>, sendCallBack?: any) => {
            return await new Promise(
                (
                    resolve: (payload: ProofPayload<any>) => any,
                    reject: (err: any) => any | any
                ) => {
                    let msg = {
                        type: `${FlowTaskType[FlowTaskType.DEPOSIT_MERGE]}`,
                        payload: {
                            depositRollupProof1: x.payload,
                            depositRollupProof2: y.payload
                        },
                    };

                    // if the method is triggered by the same process, then no need DepositRollupProof.fromJSON(*), otherwise need it!
                    if (!(x.payload instanceof DepositRollupProof)) {
                        msg.payload.depositRollupProof1 = DepositRollupProof.fromJSON(x.payload);
                    }
                    if (!(y.payload instanceof DepositRollupProof)) {
                        msg.payload.depositRollupProof2 = DepositRollupProof.fromJSON(y.payload);
                    }

                    const fromJsonFn = (proofJson: any) => {
                        return DepositRollupProof.fromJSON(proofJson);
                    }

                    generateProof(workerMap.get(CircuitName_DepositRollupProver)!, msg, fromJsonFn, resolve, reject, sendCallBack);

                }
            ).catch(e => {
                console.error(e);
            });
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
                            fee: proofPayload.payload.fee,
                            depositRollupProof: proofPayload.payload.data
                        }
                    };

                    const fromJsonFn = (proofJson: any) => {
                        return proofJson;
                    }

                    generateProof(workerMap.get(CircuitName_AnomixEntryContract)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            ).catch(e => {
                console.error(e);
            });
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

                    generateProof(workerMap.get(CircuitName_AnomixRollupContract)!, msg, fromJsonFn, resolve, reject, sendCallBack);

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

                    generateProof(workerMap.get(CircuitName_AnomixRollupContract)!, msg, fromJsonFn, resolve, reject, sendCallBack);
                }
            );
        },

    } as SubProcessCordinator;
};

const waitForAllWorkersReady = async (
    workerMap: Map<string, { worker: Worker; status: WorkerStatus; type: string }[]>
): Promise<void> => {
    let allReady = true;
    const executePoll = async (
        resolve: () => void,
        reject: (err: Error) => void | Error
    ) => {
        workerMap.forEach((arrValue, key) => {
            allReady = allReady && !arrValue.some(w => {
                return w.status == 'Busy';
            });
        });

        if (allReady) {
            console.log('all workers are ready!')
            return resolve();
        }
        console.log('wait for all workers ready...')
        setTimeout(executePoll, 60 * 1000, resolve, reject);
    };
    return new Promise(executePoll);
};

function generateProof(
    workers: { worker: Worker, status: WorkerStatus, type: string }[],
    msg: { type: string, payload: any },
    fromJsonFn,
    resolve,
    reject: (err: any) => any | any,
    sendCallBack?: any) {

    return new Promise((s, j) => {

        getFreeWorker(workers, s, j);

    }).then(workerEntity => {

        let workerE = workerEntity as { worker: Worker, status: WorkerStatus, type: string };

        const handler = (message: any) => {
            if (message.type == 'error') {// when meet errors (it's wasm32memory issue at great probability), defaultly restart the childProcess
                return;
            }

            if (workerE.type != CircuitName_AnomixRollupContract && workerE.type != CircuitName_AnomixEntryContract) {
                workerE.status = 'IsReady';
            }

            workerE.worker!.removeListener('message', handler);// must rm it here to avoid listener accumulation.

            if (message.type == 'done') {
                try {
                    let proofJson = message.payload.payload;
                    if (sendCallBack) {
                        sendCallBack(proofJson);
                    }

                    let proof = fromJsonFn(proofJson);
                    resolve({
                        isProof: true,
                        payload: proof,
                    });
                } catch (error) {
                    reject(error);
                }
            }

        }
        workerE.worker!.on('message', handler);

        // async exec
        workerE.worker!.send(msg);
    });
}

function getFreeWorker(
    workers: { worker: Worker, status: WorkerStatus, type: string }[],
    resolve,
    reject: (err: any) => any | any
) {
    let worker: { worker: Worker, status: string, type: string } | undefined = undefined;

    worker = workers.find((w) => w.status == 'IsReady');

    if (worker === undefined) {
        console.log('no free worker currently, will ask it again 1mins later...')
        setTimeout(getFreeWorker, 2 * 60 * 1000, workers, resolve, reject);
    } else {
        if (worker.type == CircuitName_AnomixEntryContract) {
            // by return, due to the last process need time to release memory(about wasm32, don't know why, but occurs), or else it will fail!

            logger.info(`worker.type: ${worker.type}, entryContractCallTimes:${entryContractCallTimes}, workerIndex: ${entryContractCallTimes % workers.length}`);

            worker = workers.at(entryContractCallTimes % workers.length);
            entryContractCallTimes++;

        } else if (worker.type == CircuitName_AnomixRollupContract) {
            // by return, due to the last process need time to release memory(about wasm32, don't know why, but occurs), or else it will fail!
            logger.info(`worker.type: ${worker.type}, rollupContractCallTimes:${rollupContractCallTimes}, workerIndex: ${rollupContractCallTimes % workers.length}`);

            worker = workers.at(rollupContractCallTimes % workers.length);
            rollupContractCallTimes++;

        }

        worker!.status = 'Busy';
        return resolve(worker);
    }
}
