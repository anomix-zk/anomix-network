import { L2Tx, MemPlL2Tx, TxStatus } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { L2TxDTOSchema } from '@anomix/types'

import { L2TxDTO } from '@anomix/types'
import { RequestHandler } from '@/lib/types'

/**
 * return all pending txs
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryPendingTxs: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/tx/pending",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<L2TxDTO[]> {
    try {
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx)
        // first query memory pool
        const tx = await mpL2TxRepository.find({ where: [{ status: TxStatus.PENDING }, { status: TxStatus.PROCESSING }] });
        return (tx ?? []) as L2TxDTO[];

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    response: {
        200: {
            type: "object",
            "properties": {
                "data": {
                    "type": "array",
                    "items": {
                        "type": (L2TxDTOSchema as any).type,
                        "properties": (L2TxDTOSchema as any).properties,
                    }
                }
            }
        }
    }
}
