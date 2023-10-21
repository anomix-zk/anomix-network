
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, BlockCacheStatus, BlockCacheType, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection } from "typeorm"
import { Block, BlockCache } from "@anomix/dao"
import { Field } from "o1js";
import { getLogger } from "@/lib/logUtils"

const logger = getLogger('syncLazyDataTree');

/**
 * sync Lazy Data Tree
 */
export const syncLazyDataTree: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merkletree/sync-data-tree",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();

    await queryRunner.startTransaction();
    try {
        const blockCacheList = await queryRunner.manager.find(BlockCache, {
            where: { type: BlockCacheType.DATA_TREE_UPDATES, status: BlockCacheStatus.CONFIRMED }, order: { blockId: 'ASC' }
        });
        if (blockCacheList.length == 0) {
            logger.info('no blockCaches for DATA_TREE_UPDATES');
            return {
                code: 0, data: '', msg: 'no blockCaches for DATA_TREE_UPDATES'
            };
        }

        logger.info(`start syncing data_tree.`);

        logger.info(`blockCacheList: ${blockCacheList.map(bc => { return { id: bc.id, blockId: bc.blockId } })}`);

        for (let index = 0; index < blockCacheList.length; index++) {
            const blockCache = blockCacheList[index];
            logger.info(`processing blockCache.id = ${blockCache.id} ...`);

            const block = await queryRunner.manager.findOne(Block, { id: blockCache.blockId });
            logger.info(`block.id: ${block!.id}, block!.dataTreeRoot0: ${block!.dataTreeRoot0}`);

            let syncDataTreeRoot = this.worldState.worldStateDB.getRoot(MerkleTreeId.SYNC_DATA_TREE, true);
            logger.info(`before sync, syncDataTreeRoot: ${syncDataTreeRoot.toString()}`);
            let syncDataTreeLeafNum = this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.SYNC_DATA_TREE, true);
            logger.info(`before sync, syncDataTreeLeafNum: ${syncDataTreeLeafNum.toString()}`);

            if (block!.dataTreeRoot0 != syncDataTreeRoot.toString()) {
                logger.error(`block.dataTreeRoot0 is not aligned with current syncDataTreeRoot`);
                throw new Error(`block.dataTreeRoot0 is not aligned with current syncDataTreeRoot`);
            }

            logger.info(`blockCache.cache: ${blockCache.cache}`);
            const commitments = (JSON.parse(blockCache.cache) as string[]).map(c => Field(c));
            logger.info(`cooresponding commitments: ${commitments.toString()}`);
            await this.worldState.worldStateDB.appendLeaves(MerkleTreeId.SYNC_DATA_TREE, commitments);

            syncDataTreeRoot = this.worldState.worldStateDB.getRoot(MerkleTreeId.SYNC_DATA_TREE, true);
            logger.info(`after sync, syncDataTreeRoot: ${syncDataTreeRoot.toString()}`);
            syncDataTreeLeafNum = this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.SYNC_DATA_TREE, true);
            logger.info(`after sync, syncDataTreeLeafNum: ${syncDataTreeLeafNum.toString()}`);

            if (block!.dataTreeRoot1 != syncDataTreeRoot.toString()) {
                logger.info(`block!.dataTreeRoot1: ${block!.dataTreeRoot1}`);

                logger.error(`after sync blockCache, block.dataTreeRoot1 is not aligned with current syncDataTreeRoot`);
                throw new Error(`after sync blockCache, block.dataTreeRoot1 is not aligned with current syncDataTreeRoot`);
            }

            logger.info(`process blockCache.id = ${blockCache.id} done.`);

            blockCache.status = BlockCacheStatus.PROCESSED;
        }

        await queryRunner.manager.save(blockCacheList);
        await queryRunner.commitTransaction();

        await this.worldState.worldStateDB.commit(); // here only 'SYNC_DATA_TREE' commits underlyingly      
        logger.info(`sync data_tree all done at this round.`);

    } catch (err) {
        await queryRunner.rollbackTransaction();
        await this.worldState.worldStateDB.rollback();
        logger.error(err);

    } finally {
        await queryRunner.release();
    }

    return {
        code: 0, data: '', msg: ''
    };

}

const schema = {
    description: 'sync Lazy Data Tree',
    tags: ['MerkleTree'],
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
