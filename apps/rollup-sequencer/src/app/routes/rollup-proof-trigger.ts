
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler, } from '@/lib/types'
import { BaseResponse, RollupTaskDto, RollupTaskDtoSchma } from "@anomix/types";
import { parentPort } from "worker_threads";

/**
 * recieve rollup proof triggering command from coordinator
 */
export const rollupProofTrigger: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/rollup/proof-trigger",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<RollupTaskDto<any, any>, null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    try {
        // forward it to main process, and will further forward it to Rollup processes.
        process.send!(req.body)

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'recieve rollup proof triggering command from coordinator',
    tags: ['ROLLUP'],
    body: {
        type: (RollupTaskDtoSchma as any).type,
        properties: (RollupTaskDtoSchma as any).properties,
    },
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

