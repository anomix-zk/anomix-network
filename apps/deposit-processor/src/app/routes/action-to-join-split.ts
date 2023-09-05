
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, RollupTaskDto, RollupTaskDtoSchma, SequencerStatus } from "@anomix/types";
import { type } from "os";

/**
 * each action to joint-split-deposit to l2Tx
 */
export const actionToJoinSplitDeposit: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/rollup/joint-split-deposit",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<RollupTaskDto<any, any>, null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    const { blockId } = req.body.payload.blockId;
    try {
        /**
         * collect all 'Pending' actions(within depositTx list) and exec 'JoinSplitProver.deposit'
         */
        await this.worldState.execActionDepositJoinSplit(blockId);

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'trigger joint-split-deposit',
    tags: ['L2Tx'],
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
