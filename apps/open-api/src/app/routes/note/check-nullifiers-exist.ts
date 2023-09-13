
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse } from "@anomix/types";
import { $axiosSeq } from "@/lib/api";
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
        const rs = await $axiosSeq.post<BaseResponse<Map<string, string>>>('/existence/nullifiers', nullifierList).then(r => {
            return r.data
        })
        return rs;
    } catch (err) {
        console.error(err);
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
            description: '{nullifier0: -1/index, nullifier1: -1/index... }',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    description: 'like this pattern {nullifier0: -1/index, nullifier1: -1/index... }',
                    type: 'any'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
