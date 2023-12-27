
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, BlockDto, BlockDtoSchema } from "@anomix/types";
import { Block } from "@anomix/dao";
import { getConnection } from 'typeorm';
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('queryBlockByBlockHash');

/**
 * query the block-hash
 */
export const queryBlockByBlockHash: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/block/:blockHash",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, { blockHash: string }> = async function (
    req,
    res
): Promise<BaseResponse<BlockDto>> {
    try {
        const connection = getConnection();

        const blockRepository = connection.getRepository(Block);
        // query latest block
        const blockEntity = (await blockRepository.findOne({
            blockHash: req.params.blockHash
        }));

        const triggerProofAt = blockEntity?.triggerProofAt.getTime();
        const finalizedAt = blockEntity?.finalizedAt.getTime();
        const updatedAt = blockEntity?.updatedAt.getTime();
        const createdAt = blockEntity?.createdAt.getTime();

        (blockEntity as any as BlockDto).triggerProofAt = triggerProofAt;
        (blockEntity as any as BlockDto).finalizedAt = finalizedAt;
        (blockEntity as any as BlockDto).updatedAt = updatedAt;
        (blockEntity as any as BlockDto).createdAt = createdAt;

        return { code: 0, data: blockEntity as any as BlockDto, msg: '' };
    } catch (err) {
        logger.error(err);
        console.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query the block hash',
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
                    items: {
                        type: (BlockDtoSchema as any).type,
                        properties: (BlockDtoSchema as any).properties,
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
