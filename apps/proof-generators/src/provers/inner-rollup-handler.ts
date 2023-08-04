import cluster, { Worker } from 'cluster';
import os from 'os';
import { TaskStack } from './task-stack.js';
import { InnerRollupProof } from '@anomix/circuits';
import { initWorker } from './proof-worker.js';
import { Field } from "snarkyjs";
import { SubProcessCordinator } from '@/create-sub-processes';
import { ProofPayload } from "../constant";

export const innerRollupBatchAndMerge = async (subProcessCordinator: SubProcessCordinator, proofPayloads: ProofPayload<any>[], sendCallBack?: any) => {
    const filterStep = (openTasks: ProofPayload<any>[]) => {
        return openTasks;
    };
    const reducerStep = async (proofPayLoadList: ProofPayload<any>[]) => {
        if (proofPayLoadList.length == 1) return [];

        let promises: Promise<any>[] = [];
        if (!proofPayLoadList[0].isProof) {
            for (let i = 0; i < proofPayLoadList.length; i++) {
                promises.push(subProcessCordinator.innerRollup_proveTxBatch(proofPayLoadList[i]));
            }
        } else {
            for (let i = 0; i < proofPayLoadList.length; i = i + 2) {
                promises.push(subProcessCordinator.innerRollup_merge(proofPayLoadList[i], proofPayLoadList[i + 1]));
            }
        }

        proofPayLoadList = await Promise.all(promises);
        return proofPayLoadList;
    };

    let queue = new TaskStack<ProofPayload<any>>(filterStep, reducerStep);

    console.log(`beginning work of ${proofPayloads.length} innerRollupBatchAndMerge cases`);

    queue.prepare(
        ...proofPayloads
    );
    let totalComputationalSeconds = Date.now();

    console.log('starting work, generating proofs in parallel');

    console.time('duration');
    let res = await queue.work();
    console.timeEnd('duration');

    console.log('result: ', res);

    console.log(
        'totalComputationalSeconds',
        (Date.now() - totalComputationalSeconds) / 1000
    );

    // send back to sequencer
    if (sendCallBack) {
        sendCallBack(res);
    }

};


