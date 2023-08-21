
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleTreeId } from "@anomix/types";
import { type } from "os";

/**
 * check if could stop deposit rollup
 */
export const queryCouldStopRollup: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/rollup/stop-mark",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    try {
        /* single thread for both http-server and deposit_rollup, so no need to check if WorldState has an onging Flow  
        // check if WorldState has an onging Flow     
        if (this.worldState.ongingFlow) {
            return {
                code: 1, data: undefined, msg: ''
            };
        } 
        */

        // if deposit_processor just send out a deposit-rollup L1tx that is not yet confirmed at Mina Chain, then return the latest DEPOSIT_TREE root !!
        // later if the seq-rollup L1Tx of the L2Block with this root is confirmed before this deposit-rollup L1tx (even though this case is rare), then the seq-rollup L1Tx fails!!
        const latestDepositTreeRoot = this.worldState.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, true);
        return {
            code: 0, data: latestDepositTreeRoot, msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check if could stop deposit rollup',
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
