
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse } from "@anomix/types";
import { $axiosSeq } from "@/lib/api";

/**
 * check if commitments exist
 */
export const checkCommitmentsExist: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/existence/commitments",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<Map<string, string>>> {
    const commitmentList = req.body

    try {
        const rs = await $axiosSeq.post<BaseResponse<Map<string, string>>>('/existence/commitments', commitmentList).then(r => {
            return r.data
        })
        // {commiment0: -1/index, commiment1: -1/index... }
        return rs;
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check in batch existence of each note commitment',
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
            description: '{commiment0: -1/index, commiment1: -1/index... }',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    description: 'like this pattern {commiment0: -1/index, commiment1: -1/index... }',
                    type: 'object',
                    additionalProperties: { type: "string" }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
