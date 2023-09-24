
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

    fs.writeFileSync(`${dirDest}/${logNamePrefix}-${proofTaskDto.index.uuid}-${getDateString()}.json`, JSON.stringify(proofTaskDto));
}


export function getDateString() {
    let date = new Date();
    let YY = date.getFullYear() + '';
    let MM =
        (date.getMonth() + 1 < 10
            ? "0" + (date.getMonth() + 1)
            : date.getMonth() + 1) + '';
    let DD = date.getDate() < 10 ? "0" + date.getDate() : date.getDate() + '-';
    let hh = (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + '';
    let mm = (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + '';
    let ss = date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
    return YY + MM + DD + hh + mm + ss;
}
