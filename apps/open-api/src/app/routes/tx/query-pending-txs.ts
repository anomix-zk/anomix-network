import { L2Tx, MemPlL2Tx, L2TxStatus } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection, In } from 'typeorm';
import { L2TxRespDtoSchema } from '@anomix/types'

import { L2TxRespDto, BaseResponse } from '@anomix/types'
import { RequestHandler } from '@/lib/types'

/**
 * return pending txs by tx hashes
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
        method: "POST",
        url: "/tx/pending-txs",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<L2TxRespDto[]>> {
    const txHashList = req.body

    try {
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx)
        // first query memory pool
        const txList = await mpL2TxRepository.find({ where: { status: In([L2TxStatus.PENDING, L2TxStatus.PROCESSING]), txHash: In(txHashList) } }) ?? [];
        const l2TxRespDtoList = txList.map(tx => {
            const { updatedAt, createdAt, proof, ...restObj } = tx;
            const txDto = (restObj as any) as L2TxRespDto;
            txDto.finalizedTs = 0;
            txDto.createdTs = 0;
            return txDto;
        });
        return {
            code: 0,
            data: l2TxRespDtoList,
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all pending txs',
    tags: ["L2Tx"],
    body: {
        type: "array",
        items: {
            type: "string"
        }
    },
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
