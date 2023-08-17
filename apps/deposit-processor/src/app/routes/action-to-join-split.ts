
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, SequencerStatus } from "@anomix/types";
import { type } from "os";

/**
 * each action to joint-split-deposit to l2Tx
 */
export const jointSplitActions: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/rollup/joint-split-deposit",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, { blockId: number }> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    const { blockId } = req.params;
    try {
        /**
         * collect all 'Pending' actions(within depositTx list) and exec 'JoinSplitProver.deposit'
         */
        await this.worldState.processDepositActions(blockId);

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'trigger joint-split-deposit',
    tags: ['L2Tx'],
    param: {
        blockId: {
            type: 'number'
        }
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
