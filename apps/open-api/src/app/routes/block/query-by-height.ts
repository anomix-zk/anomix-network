
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, BlockDto } from "@anomix/types";
import { Block } from "@anomix/dao";
import { getConnection } from 'typeorm';
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('queryLatestBlockHeight');

/**
 * query the latest block-height
 */
export const queryLatestBlockHeight: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/block/:blockHeight",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, { blockHeight: number }> = async function (
    req,
    res
): Promise<BaseResponse<BlockDto>> {
    try {
        const connection = getConnection();

        const blockRepository = connection.getRepository(Block);
        // query latest block
        const blockEntity = (await blockRepository.findOne({
            id: req.params.blockHeight
        }));


        return { code: 0, data: blockEntity, msg: '' };
    } catch (err) {
        logger.error(err);
        console.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query the latest block-height',
    tags: ['Block'],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'object',
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
