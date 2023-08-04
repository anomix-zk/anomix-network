
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, SequencerStatus } from "@anomix/types";
import { type } from "os";
import { MerkleTreeId } from "@/worldstate";

/**
 * check if could stop deposit rollup
 */
export const queryCouldStopRollup: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "network/stop-mark",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    try {
        // TODO check if WorldState has an onging Flow 
        if (this.WorldState.ongingFlow) {
            return {
                code: 1, data: undefined, msg: ''
            };
        }

        return {
            code: 0, data: {
                latestDepositTreeRoot: this.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, true)
            }, msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check if could stop deposit rollup',
    tags: ['Network'],
    body: {
        flowId: { type: 'string' }
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
