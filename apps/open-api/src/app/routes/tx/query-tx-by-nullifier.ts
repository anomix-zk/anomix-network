

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, L2TxRespDto, MerkleProofDto } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection, In } from "typeorm"
import { L2Tx } from "@anomix/dao"
import { getLogger } from "@/lib/logUtils"
import { $axiosSeq } from "@/lib/api"


const logger = getLogger('queryTxByNullifier');

export const queryTxByNullifier: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/nullifiers",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<L2Tx[]>> {
    const notehashes = req.body;

    try {
        // request sequencer for the result.
        const rs = await $axiosSeq.post<BaseResponse<L2Tx[]>>('/tx/nullifiers', notehashes).then(r => {
            return r.data
        })

        return rs;
    } catch (err) {
        console.error(err);
        logger.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query tx list by note hash list',
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
                        type: "object",
                        properties: {
                            note: {
                                type: "string"
                            },
                            txHash: {
                                type: "string"
                            },
                        }
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
