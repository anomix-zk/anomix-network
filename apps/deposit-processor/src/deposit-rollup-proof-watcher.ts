
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer } from 'snarkyjs';
import { getConnection, In } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment, DepositProverOutput, DepositTreeTrans } from '@anomix/dao';
import { AnomixEntryContract } from '@anomix/circuits';
import { syncActions } from "@anomix/utils";
import { BaseResponse, FlowTask, FlowTaskType, DepositTreeTransStatus, ProofTaskDto, ProofTaskType } from '@anomix/types';
import { $axiosProofGenerator } from './lib';

setInterval(depositRollupProofWatch, 5 * 60 * 1000);// exec/5mins

async function depositRollupProofWatch() {
    const connection = getConnection();
    const transRepo = connection.getRepository(DepositTreeTrans);
    const dTran = await transRepo.findOn({
        where: {
            status: In([DepositTreeTransStatus.PROCESSING])
        },
        order: { id: 'ASC' },
    });

    if (!dTran) {
        return;
    }

    // dTran must align with the AnomixEntryContract.state
    //
    //

    // normal status
    if (dTran.status == DepositTreeTransStatus.PROCESSING
        && !dTran.txHash
        && (new Date().getTime() - dTran.createdAt.getTime() <= 10 * 60 * 1000) {
        return;
    }

    const outputRepo = connection.getRepository(DepositProverOutput);
    await outputRepo.findOne({ where: { transId: dTran.id } }).then(async op => {
        let taskType = FlowTaskType.DEPOSIT_UPDATESTATE;
        let data: any;
        if (!op) {
            taskType = FlowTaskType.DEPOSIT_BATCH_MERGE;
        } else {
            data = op!.output
        }

        // send to proof-generator for 'DEPOSIT_BATCH_MERGE' or 'AnomixEntryContract.updateDepositState'
        const proofTaskDto = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: undefined,
            payload: {
                flowId: undefined as any,
                taskType,
                data
            } as FlowTask<any>
        } as ProofTaskDto<any, FlowTask<any>>;

        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry

    });
}
