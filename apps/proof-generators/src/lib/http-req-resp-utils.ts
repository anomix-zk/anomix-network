
import { ProofTaskDto, ProofTaskType, FlowTask, FlowTaskType } from "@anomix/types";
import fs from "fs";

export function saveProofTaskDtoFile(proofTaskDto: ProofTaskDto<any, any>, dirDest: string) {
    let logNamePrefix = 'proofTaskDto_proofResult_';
    switch (proofTaskDto.taskType) {
        case ProofTaskType.ROLLUP_FLOW:
            {
                logNamePrefix += `ROLLUP_FLOW_`
                const flowTask = proofTaskDto.payload as FlowTask<any>;

                switch (flowTask.taskType) {
                    case FlowTaskType.ROLLUP_TX_BATCH_MERGE:
                        logNamePrefix += `ROLLUP_TX_BATCH_MERGE_`
                        break;
                    case FlowTaskType.BLOCK_PROVE:
                        logNamePrefix += `BLOCK_PROVE_`
                        break;
                    case FlowTaskType.ROLLUP_CONTRACT_CALL:
                        logNamePrefix += `ROLLUP_CONTRACT_CALL_`
                        break;
                    case FlowTaskType.DEPOSIT_BATCH_MERGE:
                        logNamePrefix += `DEPOSIT_BATCH_MERGE_`
                        break;
                    case FlowTaskType.DEPOSIT_UPDATESTATE:
                        logNamePrefix += `DEPOSIT_UPDATESTATE_`
                        break;
                }
            }
            break;
        case ProofTaskType.USER_FIRST_WITHDRAW:
            logNamePrefix += `USER_FIRST_WITHDRAW_`
            break;
        case ProofTaskType.USER_WITHDRAW:
            logNamePrefix += `USER_WITHDRAW_`
            break;
        case ProofTaskType.DEPOSIT_JOIN_SPLIT:
            logNamePrefix += `DEPOSIT_JOIN_SPLIT_`
            break;
    }

    fs.writeFileSync(`${dirDest}/${logNamePrefix}-${new Date().getTime()}.json`, JSON.stringify(proofTaskDto));
}
