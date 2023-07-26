import { L2Tx } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { L2TxDTO, L2TxDTOSchema } from '@anomix/types'
import { ActionType } from "@anomix/circuits";
import { RequestHandler } from '@/lib/types'
import { WithdrawInfo } from "@anomix/dao";
import { WithdrawInfoDtoSchema } from "@anomix/types";

/**
* 提现场景中，提供L1Addr来查询相关的所有pending value notes
*/
export const queryWithdrawalNotesByL1Addr: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/tx/withdraw/:l1addr",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type WithdrawNotesReqParam = {
    l1addr: string,
    // signature: string // TODO should validate later to avoid attack
}

export const handler: RequestHandler<null, WithdrawNotesReqParam> = async function (
    req,
    res
): Promise<WithdrawInfo[]> {
    const { l1addr } = req.params
    // TODO validate signature by l1addr

    const withdrawInfoRepository = getConnection().getRepository(WithdrawInfo)
    try {
        const withdrawInfoList = await withdrawInfoRepository.find({ where: { ownerPk: l1addr } });
        return (withdrawInfoList ?? []) as WithdrawInfo[];

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    params: {
        type: "object",
        properties: {
            'l1addr': {
                type: "string",
            }
        },
        required: ['l1addr']
    },
    response: {
        200: {
            "type": "object",
            "properties": {
                "data": {
                    "type": "array",
                    "items": {
                        "type": (WithdrawInfoDtoSchema as any).type,
                        "properties": (WithdrawInfoDtoSchema as any).properties,
                    }
                }
            },
        }
    }
}

