
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, BlockCacheType, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection } from "typeorm"
import { Block, BlockCache } from "@anomix/dao"
import { Field } from "o1js";


/**
 * sync Lazy Data Tree By BlockId
 */
export const syncLazyDataTreeByBlockId: FastifyPlugin = async function (
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

export const handler: RequestHandler<null, { blockId: number }> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const blockId = req.params.blockId;

    try {

        const blockRepo = getConnection().getRepository(Block);
        const block = (await blockRepo.findOne({ where: { id: blockId } }));

        if (!block) {
            return {
                code: 1, data: '', msg: 'non-exiting blockId'
            };
        }

        // check if sync_date_tree root is aligned with 
        // check if duplicated call
        const syncDataTreeRoot = this.worldState.worldStateDBLazy.getRoot(MerkleTreeId.DATA_TREE, false);
        if (block.dataTreeRoot0 == syncDataTreeRoot.toString()) {
            const blockCacheRepo = getConnection().getRepository(BlockCache);
            const cachedStr = (await blockCacheRepo.findOne({ where: { blockId, type: BlockCacheType.DATA_TREE_UPDATES } }))!.cache;

            const blockCachedUpdates1 = (JSON.parse(cachedStr) as Array<string>).map(i => Field(i));
            await this.worldState.worldStateDBLazy.appendLeaves(MerkleTreeId.DATA_TREE, blockCachedUpdates1);

            await this.worldState.worldStateDBLazy.commit(); // here only 'DATA_TREE' commits underlyingly           

            return {
                code: 0, data: '', msg: ''
            };
        } else {
            return {
                code: 1, data: '', msg: 'rejected duplicated call!'
            };
        }

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'sync Lazy Data Tree By BlockId',
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
