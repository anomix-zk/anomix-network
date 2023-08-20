

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, L2TxRespDto } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { $axiosProofGenerator } from "@/lib/api"
import { getConnection, In } from "typeorm"
import { L2Tx, Block } from "@anomix/dao"

/**
* 根据alias_nullifier/account_viewing_key/valueNote_commitment/nullifier查询L2Tx
*/
export const queryTxByNoteHash: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/notehashes",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<L2TxRespDto[]>> {
    const notehashes = req.body

    try {
        let l2TxRespDtoList: L2TxRespDto[] = []
        // TODO
        //
        //
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
