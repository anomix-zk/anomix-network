
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, SequencerStatus } from "@anomix/types";

/**
 * trigger deposit rollup
 */
export const triggerRollupBatch: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/rollup/start",
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
        // start a new flow! 
        await this.WorldState.startNewFlow();

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'trigger deposit rollup',
    tags: ['Rollup'],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'number'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
