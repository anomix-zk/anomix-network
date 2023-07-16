/**
* 供client根据TxId查询L2 tx的状态、数据
*/
// GET /tx/id/:id


import { L2Tx } from "@/lib/orm/entity/l2_tx";

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import L2TxDTOSchema from "@/types/L2TxDTO-schema.json";

import { RequestHandler, L2TxDTO } from '@/types'

export const queryByTxId: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/tx/id/:id",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type TxReqParam = { txId: string }

export const handler: RequestHandler<null, TxReqParam> = async function (
    req,
    res
): Promise<L2TxDTO> {
    const { txId } = req.params

    const txRepository = getConnection().getRepository(L2Tx)
    try {
        const tx = await txRepository.findOne({ where: { txId } });
        return (tx ?? {}) as L2TxDTO;

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    params: {
        type: "object",
        properties: {
            id: {
                type: "string",
            }
        }
    },
    response: {
        200: {
            "type": L2TxDTOSchema.type,
            "properties": L2TxDTOSchema.properties,
        }
    }
}
