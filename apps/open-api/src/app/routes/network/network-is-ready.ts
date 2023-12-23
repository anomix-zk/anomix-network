
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, NetworkStatus } from "@anomix/types";
import { $axiosSeq } from "@/lib/api";

/**
 * check if the sequencer is ready
 */
export const isNetworkReady: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/isready",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    try {
        const rs = await $axiosSeq.get<string>('/health').then(r => {
            return r.data
        })

        if (rs == NetworkStatus.ALIVE) {
            return { code: 0, data: true, msg: '' };
        }
        return { code: 1, data: false, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check if the sequencer is ready',
    tags: ['Network'],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'boolean'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
