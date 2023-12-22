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

export class SubProcessCordinator {

    constructor(public workerMap: Map<string, { worker: Worker; status: WorkerStatus; type: string }[]>
    ) { }

    innerRollupProveTxBatch(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        // 
    }

    innerRollupMerge(proofPayload1: ProofPayload<any>, proofPayload2: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    depositRollupCommitActionBatch(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    depositRollupMerge(x: ProofPayload<any>, y: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    jointSplitDeposit(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<>> {
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

                const workers = this.workerMap.get(CircuitName_JoinSplitProver)!;
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
                            this.workerMap.get(CircuitName_JoinSplitProver)!.find(
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
    }

    blockProve(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    depositContract_updateDepositState(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    rollupContractFirstWithdraw(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    rollupContractWithdraw(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }

    rollupContractUpdateRollupState(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void): Promise<ProofPayload<any>> {
        //
    }
}
