
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse } from "@anomix/types";
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
        url: "/block/latest-height",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<number>> {
    try {
        const connection = getConnection();

        const blockRepository = connection.getRepository(Block);
        // query latest block
        const blockEntity = (await blockRepository.find({
            select: [
                'id'
                /*,
                'blockHash',
                'l1TxHash',
                'status',
                'createdAt',
                'finalizedAt'
                */
            ],
            order: {
                id: 'DESC'
            },
            take: 1
        }))[0];
        /*
        const latestBlockDto = {} as LatestBlockDto;
        latestBlockDto.blockHeight = blockEntity.id;
        latestBlockDto.blockHash = blockEntity.blockHash;
        latestBlockDto.l1TxHash = blockEntity.l1TxHash;
        latestBlockDto.status = blockEntity.status;
        latestBlockDto.createdTs = blockEntity.createdAt.getTime();
        latestBlockDto.finalizedTs = blockEntity.finalizedAt.getTime();
        */

        return { code: 0, data: blockEntity?.id ?? 0, msg: '' };
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
                    type: 'number',
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
