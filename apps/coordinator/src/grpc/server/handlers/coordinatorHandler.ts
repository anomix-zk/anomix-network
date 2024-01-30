import { BaseResponse, RollupTaskDto, RollupTaskType } from "@anomix/types";
import { parentPort } from "worker_threads";
import { $axiosSeq } from "@/lib/api";

export function highFeeTxExist() {
    try {
        // notify worker to seq.
        (process.send as any)({// when it's a subProcess 
            type: 'seq',
            data: ''
        });
        parentPort?.postMessage({// when it's a subThread
            type: 'seq',
            data: ''
        });
        return { code: 0, data: '', msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function proofNotify(dto: RollupTaskDto<any, any>) {
    try {
        const targetId = dto.payload.blockId as number;

        const respondData: any = undefined;

        if (dto.taskType == RollupTaskType.DEPOSIT_JOINSPLIT) {// when join-split_deposit done, coordinator trigger ROLLUP_PROCESSOR to start rolluping; 
            // trigger ROLLUP_PROCESSOR to start rolluping; 
            dto.taskType = RollupTaskType.ROLLUP_PROCESS;
            await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', dto);

        }

        return { code: 0, data: respondData, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
