import { L2Tx, MemPlL2Tx } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { TxFeeSuggestionDto, TxFeeSuggestionDtoSchema, BaseResponse, L2TxStatus } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import config from '@/lib/config';

/**
 * query tx fee suggestions
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryTxFeeSuggestions: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/txfees",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<TxFeeSuggestionDto>> {
    try {
        // TODO future improve: query sequencer
        //
        //
        return {
            code: 0,
            data: {
                assetId: 0,
                faster: config.txFeeFloor,
                normal: config.txFeeFloor,
                floor: config.txFeeFloor
            },
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query tx fees suggestions',

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
                    properties: (TxFeeSuggestionDtoSchema as any).properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
