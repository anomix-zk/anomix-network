import cp from "child_process";
import cluster from "cluster";
import { activeMinaInstance } from "@anomix/utils";
import { ProofTaskDto, ProofTaskType, FlowTask, FlowTaskType } from "@anomix/types";
import config from "./lib/config";
import { innerRollupBatchAndMerge } from "./provers/inner-rollup-handler";
import { depositRollupBatchAndMerge } from "./provers/deposit-rollup-handler";
import { ProofPayload } from "./constant";
import { createSubProcesses, SubProcessCordinator } from "./create-sub-processes";
import { JoinSplitDepositInput } from "@anomix/circuits";
import { getLogger } from "./lib/logUtils";
import { $axiosDeposit, $axiosSeq } from "./lib";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = getLogger('proof-generator');

function bootWebServerThread(subProcessCordinator: SubProcessCordinator) {
    // init worker thread A
    let httpWorker = cp.fork(`${__dirname}/web-server.js`, ['child']);
    httpWorker.on('online', () => {
        logger.info('web-server worker is online...');
    })

    httpWorker.on('exit', (exitCode: number) => {
        console.log('webServer process exit...')
        // create a new worker for http-server
        bootWebServerThread(subProcessCordinator);
    })

    httpWorker.on('message', (proofTaskDto: ProofTaskDto<any, any>) => {
        try {
            const sendResultDepositCallback = async (p: any) => {
                proofTaskDto.payload.data.data = p;
                await $axiosDeposit.post('/proof-result', proofTaskDto).then(value => {
                    console.log('$axiosDeposit.post to /proof-result, response:', value);
                }).catch(reason => {
                    console.log('$axiosDeposit.post to /proof-result, error:', reason);
                });
            }
            const sendResultDepositJoinSplitCallback = async (p: any) => {
                proofTaskDto.payload = p;
                await $axiosDeposit.post('/proof-result', proofTaskDto).then(value => {
                    console.log('$axiosDeposit.post to /proof-result, response:', value);
                }).catch(reason => {
                    console.log('$axiosDeposit.post to /proof-result, error:', reason);
                });
            }
            const sendResultSeqCallback = async (p: any) => {
                (proofTaskDto.payload as FlowTask<any>).data = p.payload;
                fs.writeFileSync(`./proofTaskDto_proofResult_${new Date().getTime()}_json`, JSON.stringify(proofTaskDto));

                await $axiosSeq.post('/proof-result', proofTaskDto).then(value => {
                    console.log('$axiosSeq.post to /proof-result, response:', value);
                }).catch(reason => {
                    console.log('$axiosSeq.post to /proof-result, error:', reason);
                });
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
                                    let proofPayload = {
                                        isProof: false,
                                        payload: flowTask.data
                                    } as ProofPayload<any>;

                                    subProcessCordinator.depositContract_updateDepositState(proofPayload, sendResultDepositCallback)
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

                        subProcessCordinator.rollupContract_withdraw(payload, sendResultSeqCallback);
                    }
                    break;

                case ProofTaskType.DEPOSIT_JOIN_SPLIT:
                    {
                        let payload = {
                            isProof: false,
                            payload: proofTaskDto.payload
                        } as ProofPayload<any>;

                        subProcessCordinator.jointSplit_deposit(payload, sendResultDepositJoinSplitCallback);
                    }
                    break;

                default:
                    break;
            }
        } catch (error) {
            // notice: don't throw error, will make primary process exit!
            logger.error(error);
            console.error(error);
        }
    })
}

const proof_generation_init = async () => {
    // init Mina tool
    await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

    if (cluster.isPrimary) {
        let subProcessCordinator = await createSubProcesses(config.subProcessCnt);
        // start web server in worker thread
        bootWebServerThread(subProcessCordinator);
    }/*  else {// sub processes:
        await initWorker();
    } */
}

await proof_generation_init();

