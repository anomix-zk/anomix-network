import { L2Tx, MemPlL2Tx } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { WorldStateRespDto, WorldStateRespDtoSchema, BaseResponse, L2TxStatus } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { $axiosSeq } from '@/lib/api';
import { getLogger } from '@/lib/logUtils';

const logger = getLogger('queryWorldStateworldState');

/**
 * query all trees' roots
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryWorldStateworldState: FastifyPlugin = async function (
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
        const rs = await $axiosSeq.get<BaseResponse<WorldStateRespDto>>('/network/worldstate').then(r => { return r.data });
        return rs;
    } catch (err) {
        logger.error(err);
        console.error(err);

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
