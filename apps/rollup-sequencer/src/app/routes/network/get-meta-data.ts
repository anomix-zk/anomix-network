// '/get-meta-data': 获取元数据，如合约地址、合约状态、innerRollup的拼接数量等

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { NetworkMetaDto, NetworkMetaDtoSchema, BaseResponse } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import config from "@/lib/config"
import { DATA_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT } from "@anomix/circuits"

/**
 * query network meta data
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryNetworkMetaData: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/metadata",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<NetworkMetaDto>> {
    try {
        // query sequencer
        return {
            code: 0, data: {
                rollupContractAddress: config.rollupContractAddress,
                depositContractAddress: config.entryContractAddress,
                vaultContractAddress: config.vaultContractAddress,
                dataTreeHeight: DATA_TREE_HEIGHT,
                nullifierTreeHeight: NULLIFIER_TREE_HEIGHT,
                rootTreeHeight: ROOT_TREE_HEIGHT,
                withdrawTreeHeight: NULLIFIER_TREE_HEIGHT,

            }, msg: ''
        };

    } catch (err) {
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
                    properties: (NetworkMetaDtoSchema as any).properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
