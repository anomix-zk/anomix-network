
import { getConnection, In, LessThan } from 'typeorm';
import { DepositRollupBatch, DepositTreeTrans } from '@anomix/dao';
import { BaseResponse, FlowTask, FlowTaskType, DepositTreeTransStatus, ProofTaskDto, ProofTaskType } from '@anomix/types';
import { $axiosProofGenerator } from './lib';
import { getLogger } from "@/lib/logUtils";
import { activeMinaInstance } from '@anomix/utils';

const logger = getLogger('deposit-rollup-proof-watcher');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

const periodRange = 5 * 60 * 1000

setInterval(depositRollupProofWatch, periodRange); // exec/5mins

/**
 * the flowScheduler would try to send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)' as soon as the seq done, but if fail, then this timing task would help re-trigger!
 */
async function depositRollupProofWatch() {
    logger.info('start depositRollupProofWatch...');

    const connection = getConnection();
    const transRepo = connection.getRepository(DepositTreeTrans);
    const dTranList = await transRepo.find({
        where: {
            status: In([DepositTreeTransStatus.PROCESSING]),
            createdAt: LessThan(new Date(new Date().getTime() - periodRange * 3)) // created before 15mins, means they failed on previous execution--'InnerRollupProver.proveTxBatch(*)'
        },
        order: { id: 'ASC' },
    }) ?? [];

    if (dTranList?.length == 0) {
        return;
    }

    await dTranList.forEach(async dTran => {
        // MUST save the circuit's parameters for later new proof-gen tries
        const rollupBatchRepo = connection.getRepository(DepositRollupBatch);
        const depositRollupBatch = await rollupBatchRepo.findOne({ where: { transId: dTran.id } });

        // try to send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*)'
        try {
            const proofTaskDto = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: undefined,
                payload: {
                    flowId: undefined as any,// no need
                    taskType: FlowTaskType.DEPOSIT_BATCH_MERGE,
                    data: { transId: dTran.id, data: depositRollupBatch!.inputParam }
                } as FlowTask<any>
            } as ProofTaskDto<any, FlowTask<any>>;
            await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            });// TODO future: could improve when fail by 'timeout' after retry
        } catch (error) {
            logger.error(error);
        }
    });

}
