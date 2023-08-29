
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, BlockCacheType, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection } from "typeorm"
import { BlockCache } from "@anomix/dao"
import { Field } from "snarkyjs";


/**
 * query MerkleTree Info
 */
export const syncLazyDataTree: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merkletree/sync/:blockId",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, number> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const blockId = req.params;

    try {
        const blockCacheRepo = getConnection().getRepository(BlockCache);
        const blockCachedUpdates = (await blockCacheRepo.findOne({ where: { blockId, type: BlockCacheType.DATA_TREE_UPDATES } }))!.cache;

        const cached = JSON.parse(blockCachedUpdates);
        const keys = Object.getOwnPropertyNames(cached);
        const batch: Field[] = [];
        for (const key of keys) {
            batch.push(cached[key]);
        }
        this.worldState.worldStateDB.appendLeaves(MerkleTreeId.SYNC_DATA_TREE, batch);
        this.worldState.worldStateDB.commit(); // here only 'SYNC_DATA_TREE' commits

        return {
            code: 0, data: '', msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query MerkleTree Info',
    tags: ['MerkleTree'],
    params: {
        type: "object",
        properties: {
            blockId: {
                type: "number",
            }
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
                    type: 'string'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
