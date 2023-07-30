import { L2Tx, MemPlL2Tx, L2TxStatus } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { WorldStateRespDto, WorldStateRespDtoSchema, BaseResponse } from '@anomix/types'
import { RequestHandler } from '@/lib/types'

/**
 * query all trees' roots
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryWorldStateStatus: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/worldstate",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<WorldStateRespDto>> {
    try {
        // query sequencer
        //
        //
        return {
            code: 0,
            data: ({}) as WorldStateRespDto,
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all trees roots',

    tags: ["Network"],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "object",
                    properties: (WorldStateRespDtoSchema as any).properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
