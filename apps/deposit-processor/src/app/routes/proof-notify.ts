
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, RollupTaskDto, RollupTaskDtoSchma, RollupTaskType, SequencerStatus } from "@anomix/types";
import { $axiosSeq } from "@/lib/api";
import { getConnection } from "typeorm";
import { AnomixEntryContract } from "@anomix/circuits";
import { DepositTreeTrans } from "@anomix/dao";
import { syncAcctInfo } from "@anomix/utils";
import { config } from "dotenv";
import { PublicKey } from "o1js";

/**
 * * when join-split_deposit done, notify coordinator;
 * * when L2Block_proved done, notify coordinator;
 */
export const proofNotify: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/deposit/proof-notify",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<RollupTaskDto<any, any>, null> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    try {
        const dto = req.body;
        const targetId = dto.payload.blockId as number;

        const respondData: any = undefined;

        if (dto.taskType == RollupTaskType.DEPOSIT_JOINSPLIT) {// when join-split_deposit done, coordinator trigger ROLLUP_PROCESSOR to start rolluping; 
            // trigger ROLLUP_PROCESSOR to start rolluping; 
            dto.taskType = RollupTaskType.ROLLUP_PROCESS;
            await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', dto);

        }

        return { code: 0, data: respondData, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'when (join-split_deposit is done), notify coordinator',
    tags: ['ROLLUP'],
    body: {
        type: (RollupTaskDtoSchma as any).type,
        properties: (RollupTaskDtoSchma as any).properties,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'string',
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
