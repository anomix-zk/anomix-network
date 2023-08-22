import { Worker as HttpWorker } from "worker_threads";
import { activeMinaInstance } from "@anomix/utils";
import { ProofTaskDto, ProofTaskType, FlowTask, FlowTaskType } from "@anomix/types";
import config from "./lib/config";
import { innerRollupBatchAndMerge } from "./provers/inner-rollup-handler";
import { depositRollupBatchAndMerge } from "./provers/deposit-rollup-handler";
import { ProofPayload } from "./constant";
import { createSubProcesses, SubProcessCordinator } from "./create-sub-processes";
import axios from "axios";
import { JoinSplitDepositInput } from "@anomix/circuits";

function bootWebServerThread(subProcessCordinator: SubProcessCordinator) {
    // init worker thread A
    let httpWorker = new HttpWorker('./web-server.js');
    httpWorker.on('online', () => {
        console.log('web-server worker is online...');
    })

    httpWorker.on('exit', (exitCode: number) => {
        // create a new worker for http-server
        bootWebServerThread(subProcessCordinator);
    })

    httpWorker.on('message', (proofTaskDto: ProofTaskDto<any, any>) => {
        const sendResultDepositCallback = async (p: any) => {
            proofTaskDto.payload.data.data = p;
            axios.post(`http://${config.depositProcessorHost}:${config.depositProcessorPort}/proof-result`, proofTaskDto);
        }

        const sendResultDepositJoinSplitCallback = async (p: any) => {
            proofTaskDto.payload = p;
            axios.post(`http://${config.depositProcessorHost}:${config.depositProcessorPort}/proof-result`, proofTaskDto);
        }
        const sendResultSeqCallback = async (p: any) => {
            (proofTaskDto.payload as FlowTask<any>).data = p;
            axios.post(`http://${config.sequencerProcessorHost}:${config.sequencerProcessorPort}/proof-result`, proofTaskDto);
        }

        // recieve from http-server thread
        switch (proofTaskDto.taskType) {
            case ProofTaskType.ROLLUP_FLOW:
                {
                    const flowTask = proofTaskDto.payload as FlowTask<any>;

                    switch (flowTask.taskType) {
                        case FlowTaskType.ROLLUP_TX_BATCH_MERGE:
                            {
                                let payloads = (flowTask.data as (any[])).map(d => {
                                    return {
                                        isProof: false,
                                        payload: d
                                    } as ProofPayload<any>;
                                });
                                innerRollupBatchAndMerge(subProcessCordinator, payloads, sendResultSeqCallback);
                            }

                            break;
                        /* 
                        case FlowTaskType.ROLLUP_MERGE:
                            {
                                let payloads = (flowTask.data as (any[])).map(d => {
                                    return {
                                        isProof: false,
                                        payload: d
                                    } as ProofPayload<any>;
                                });
                                subProcessCordinator.innerRollup_merge(payloads[0], payloads[1], sendResultSeqCallback);
                            }

                            break; 
                        */

                        case FlowTaskType.BLOCK_PROVE:
                            {
                                let payload = {
                                    isProof: false,
                                    payload: flowTask.data
                                } as ProofPayload<any>;

                                subProcessCordinator.blockProve(payload, sendResultSeqCallback);
                            }

                            break;

                        case FlowTaskType.ROLLUP_CONTRACT_CALL:
                            {
                                let payload = {
                                    isProof: false,
                                    payload: flowTask.data
                                } as ProofPayload<any>;

                                subProcessCordinator.rollupContract_updateRollupState(payload, sendResultSeqCallback)
                            }

                            break;


                        case FlowTaskType.DEPOSIT_BATCH_MERGE:
                            {
                                let payloads = (flowTask.data.data as (any[])).map(d => {
                                    return {
                                        isProof: false,
                                        payload: d
                                    } as ProofPayload<any>;
                                });
                                depositRollupBatchAndMerge(subProcessCordinator, payloads, sendResultDepositCallback);
                            }

                            break;

                        /*
                        case ProofTaskType.DEPOSIT_MERGE:
                            {
                                let payloads = (proofTaskDto.payload as (any[])).map(d => {
                                    return {
                                        isProof: false,
                                        payload: d
                                    } as ProofPayload<any>;
                                });
                                subProcessCordinator.depositRollup_merge(payloads[0], payloads[1], sendResultDepositCallback);
                            }

                            break;
                        */

                        case FlowTaskType.DEPOSIT_UPDATESTATE:
                            {
                                let payload = {
                                    isProof: false,
                                    payload: flowTask.data.data
                                } as ProofPayload<any>;

                                subProcessCordinator.depositContract_updateDepositState(payload, sendResultDepositCallback)
                            }
                            break;

                        default:
                            break;

                    }
                }

                break;

            case ProofTaskType.USER_FIRST_WITHDRAW:
                {
                    let payload = {
                        isProof: false,
                        payload: proofTaskDto.payload
                    } as ProofPayload<any>;

                    subProcessCordinator.rollupContract_firstWithdraw(payload, sendResultSeqCallback);
                }
                break;

            case ProofTaskType.USER_WITHDRAW:
                {
                    let payload = {
                        isProof: false,
                        payload: proofTaskDto.payload
                    } as ProofPayload<any>;

                    subProcessCordinator.rollupContract_firstWithdraw(payload, sendResultSeqCallback);
                }
                break;

            case ProofTaskType.DEPOSIT_JOIN_SPLIT:
                {
                    let payload = {
                        isProof: false,
                        payload: proofTaskDto.payload as { blockId: number, data: { txId: number, data: JoinSplitDepositInput }[] }
                    } as ProofPayload<any>;

                    subProcessCordinator.jointSplit_deposit(payload, sendResultDepositJoinSplitCallback);
                }
                break;

            default:
                break;
        }

    })
}

const proof_generation_init = async () => {
    // init Mina tool
    await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

    let subProcessCordinator = await createSubProcesses(config.subProcessCnt);

    // start web server in worker thread
    bootWebServerThread(subProcessCordinator);
}

proof_generation_init();

