import { L2Tx, MemPlL2Tx, TxStatus } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { L2TxRespDtoSchema } from '@anomix/types'

import { L2TxRespDto, BaseResponse } from '@anomix/types'
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
        url: "/network/pending-txs",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<L2TxRespDto[]>> {
    try {
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx)
        // first query memory pool
        const tx = await mpL2TxRepository.find({ where: [{ status: TxStatus.PENDING }, { status: TxStatus.PROCESSING }] });
        return {
            code: 0,
            data: ((tx ?? []) as any) as L2TxRespDto[],
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all pending txs',

    tags: ["Network"],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "array",
                    items: {
                        type: (L2TxRespDtoSchema as any).type,
                        properties: (L2TxRespDtoSchema as any).properties,
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
