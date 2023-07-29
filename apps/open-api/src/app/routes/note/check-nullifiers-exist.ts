
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse } from "@anomix/types";
/**
 * check if nullifiers exist
 */
export const checkNullifiersExist: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/existence/nullifiers",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<object>> {
    const nullifierList = req.body

    try {
        /**
         * TODO  request sequencer for the result.
         */

        return { code: 0, data: {}, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check in batch existence of nullifier list including noteNullifier/aliasNullifier/acctViewPubKeyNullifier',
    tags: ['NOTE'],
    body: {
        type: 'array',
        items: {
            type: 'string'
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
                    type: 'object',
                    properties: {}
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
