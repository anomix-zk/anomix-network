import { L2Tx } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { RequestHandler, L2TxDTO, L2TxDTOSchema } from '@anomix/types'
import { ActionType } from "@anomix/circuits";

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
        url: "/tx/l1addr/:l1addr",
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
): Promise<L2TxDTO[]> {
    const { l1addr } = req.params
    // TODO validate signature by l1addr

    const txRepository = getConnection().getRepository(L2Tx)
    try {
        const txList = await txRepository.find({ where: { action_type: ActionType.WITHDRAW, public_owner: l1addr } });// TODO replace 2 by ActionType.WITHDRAW
        return (txList ?? []) as L2TxDTO[];

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
            "type": (L2TxDTOSchema as any).type,
            "properties": (L2TxDTOSchema as any).properties,
        }
    }
}
