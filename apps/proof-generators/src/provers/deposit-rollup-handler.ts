import { TaskStack } from './task-stack.js';
import { SubProcessCordinator } from '@/create-sub-processes';
import { ProofPayload } from "../constant";
import { getLogger } from "../lib/logUtils";

const logger = getLogger('deposit-rollup-handler');

export const depositRollupBatchAndMerge = async (subProcessCordinator: SubProcessCordinator, proofPayloads: ProofPayload<any>[], sendCallBack?: any) => {
    const filterStep = (openTasks: ProofPayload<any>[]) => {
        return openTasks;
    };
    const reducerStep = async (proofPayLoadList: ProofPayload<any>[]) => {
        if (proofPayLoadList.length == 1) return [];

        let promises: Promise<any>[] = [];
        if (!proofPayLoadList[0].isProof) {
            for (let i = 0; i < proofPayLoadList.length; i++) {
                promises.push(subProcessCordinator.depositRollup_commitActionBatch(proofPayLoadList[i]));
            }
        } else {
            for (let i = 0; i < proofPayLoadList.length; i = i + 2) {
                if (proofPayLoadList[i + 1]) {
                    promises.push(subProcessCordinator.depositRollup_merge(proofPayLoadList[i], proofPayLoadList[i + 1]));
                } else {
                    promises.push(Promise.resolve(proofPayLoadList[i]));
                }
            }
        }

        proofPayLoadList = await Promise.all(promises);
        return proofPayLoadList;
    };

    let queue = new TaskStack<ProofPayload<any>>(filterStep, reducerStep);

    logger.info(`beginning work of ${proofPayloads.length} depositRollupBatchAndMerge cases`);

    queue.prepare(
        ...proofPayloads
    );
    let totalComputationalSeconds = Date.now();

    logger.info('starting work, generating proofs in parallel');

    console.time('duration');
    let res = await queue.work();
    console.timeEnd('duration');

    logger.info('result: ', res);

    logger.info(
        'totalComputationalSeconds',
        (Date.now() - totalComputationalSeconds) / 1000
    );


    // send back to deposit-processor
    if (sendCallBack) {
        sendCallBack(res);
    }

};


