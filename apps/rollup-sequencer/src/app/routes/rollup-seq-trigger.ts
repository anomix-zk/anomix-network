
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler, } from '@/lib/types'
import { BaseResponse, RollupTaskDto, RollupTaskDtoSchma } from "@anomix/types";
import { parentPort } from "worker_threads";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('rollupSeqTrigger');

/**
 * recieve rollup seq triggering command from coordinator
 */
export const rollupSeqTrigger: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/rollup/seq-trigger",
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
        // if (worldState.ongingFlow) {// single thread for 'seq', no need check!
        //     return;
        // }
        await this.worldState.startNewFlow();

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        logger.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'recieve seq triggering command from coordinator',
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

