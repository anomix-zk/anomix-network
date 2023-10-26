
import { FastifyPlugin } from "fastify"
import { BaseResponse, BlockCacheStatus, BlockCacheType, MerkleTreeError, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { In, LessThanOrEqual, getConnection } from "typeorm"
import { Block, BlockCache } from "@anomix/dao"
import { Field } from "o1js";
import { getLogger } from "@/lib/logUtils"
import { getDateString } from "@/lib/timeUtils"
import config from "@/lib/config"
import { WorldStateDB } from "@/worldstate"
import fs from "fs";
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
    let treeInconsistentFlag = false;
    let treeIssueAtBlockId = 0;

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
            let blockCache = blockCacheList[index];
            logger.info(`processing blockCache.id = ${blockCache.id} ...`);

            const block = await queryRunner.manager.findOne(Block, { id: blockCache.blockId });
            logger.info(`block.id: ${block!.id}, block!.dataTreeRoot0: ${block!.dataTreeRoot0}`);
            // record treeIssueAtBlockId for later handle when issue occur...
            treeIssueAtBlockId = block!.id;

            let syncDataTreeRoot = this.worldState.worldStateDBLazy.getRoot(MerkleTreeId.DATA_TREE, true);
            logger.info(`before sync, syncDataTreeRoot: ${syncDataTreeRoot.toString()}`);
            let syncDataTreeLeafNum = this.worldState.worldStateDBLazy.getNumLeaves(MerkleTreeId.DATA_TREE, true);
            logger.info(`before sync, syncDataTreeLeafNum: ${syncDataTreeLeafNum.toString()}`);

            if (block!.dataTreeRoot0 != syncDataTreeRoot.toString()) {
                treeInconsistentFlag = true;
                logger.error(`block.dataTreeRoot0 is not aligned with current syncDataTreeRoot`);
                throw new MerkleTreeError(MerkleTreeId.DATA_TREE, `block.dataTreeRoot0 is not aligned with current syncDataTreeRoot`);
            }

            logger.info(`blockCache.cache: ${blockCache.cache}`);
            const commitments = (JSON.parse(blockCache.cache) as string[]).map(c => Field(c));
            logger.info(`cooresponding commitments: ${commitments.toString()}`);
            await this.worldState.worldStateDBLazy.appendLeaves(MerkleTreeId.DATA_TREE, commitments);

            syncDataTreeRoot = this.worldState.worldStateDBLazy.getRoot(MerkleTreeId.DATA_TREE, true);
            logger.info(`after sync, syncDataTreeRoot: ${syncDataTreeRoot.toString()}`);
            syncDataTreeLeafNum = this.worldState.worldStateDBLazy.getNumLeaves(MerkleTreeId.DATA_TREE, true);
            logger.info(`after sync, syncDataTreeLeafNum: ${syncDataTreeLeafNum.toString()}`);

            if (block!.dataTreeRoot1 != syncDataTreeRoot.toString()) {
                treeInconsistentFlag = true;

                logger.info(`block!.dataTreeRoot1: ${block!.dataTreeRoot1}`);

                logger.error(`after sync blockCache, block.dataTreeRoot1 is not aligned with current syncDataTreeRoot`);
                throw new MerkleTreeError(MerkleTreeId.DATA_TREE, `after sync blockCache, block.dataTreeRoot1 is not aligned with current syncDataTreeRoot`);
            }

            logger.info(`process blockCache.id = ${blockCache.id} done.`);

            blockCache.status = BlockCacheStatus.PROCESSED;
        }

        await queryRunner.manager.save(blockCacheList);
        await queryRunner.commitTransaction();

        await this.worldState.worldStateDBLazy.commit(); // here only 'DATA_TREE' commits underlyingly      
        logger.info(`sync data_tree all done at this round.`);

    } catch (err) {
        logger.error(err);

        try {
            await queryRunner.rollbackTransaction();
            logger.info('mysqldb.rollbackTransaction.');
        } catch (error) {
            logger.error('mysqldb.rollbackTransaction failed!');
        }

        await this.worldState.worldStateDBLazy.rollback();

    } finally {
        await queryRunner.release();
    }

    if (treeInconsistentFlag && treeIssueAtBlockId > 1) {
        logger.info(`start rebuilding WorldStateDBLazy...`);

        const currentDateString = getDateString();
        const rebuildWorldStateDBLazyPath = config.worldStateDBLazyPath.concat(`-block-${treeIssueAtBlockId - 1}-rebuilding-${currentDateString}`);
        const rebuildWorldStateDBLazy = new WorldStateDB(rebuildWorldStateDBLazyPath);

        try {
            const treeId = MerkleTreeId.DATA_TREE;
            // if merkletree error, then new trees instantly and switch to the new ones!
            const blockCacheList = await getConnection().getRepository(BlockCache)
                .find({
                    where: {
                        type: BlockCacheType.DATA_TREE_UPDATES,
                        blockId: LessThanOrEqual(treeIssueAtBlockId - 1) // till 'treeIssueAtBlockId - 1'
                    },
                    order: { blockId: 'ASC' }
                });

            logger.info(`start rebuild ${MerkleTreeId[treeId]} ...`);

            for (let i = 0; i < blockCacheList.length; i++) {
                const blockCache = blockCacheList[i];
                logger.info(`  processing blockCache[${blockCache.id}] at Block[${blockCache.blockId}]...`);
                await rebuildWorldStateDBLazy.appendLeaves(treeId, (JSON.parse(blockCache.cache) as string[]).map(c => Field(c)));

                const existingCurrentBlock = await getConnection().getRepository(Block).findOne({ where: { id: blockCache.blockId } });
                const newRoot = rebuildWorldStateDBLazy.getRoot(treeId, true).toString();
                logger.info(`  new ${MerkleTreeId[treeId]} root: ${newRoot}`);
                logger.info(`  existingCurrentBlock.dataTreeRoot1: ${existingCurrentBlock!.dataTreeRoot1}`);

                if (newRoot != existingCurrentBlock!.dataTreeRoot1) {
                    logger.error(`  rebuild ${MerkleTreeId[treeId]} failed, due to two roots are not equal.`);
                    throw new Error(`rebuild ${MerkleTreeId[treeId]} failed, due to two roots are not equal.`);
                }
            }
            logger.info(`  append all Leaves done.`);

            logger.info(`rebuildWorldStateDBLazy.commit...`);
            await rebuildWorldStateDBLazy.commit();

            logger.info(`rebuildWorldStateDBLazy close...`);
            await rebuildWorldStateDBLazy.close();
            logger.info(`original worldStateDBLazy close...`);
            await this.worldState.worldStateDBLazy.close();

            const migrateDir = config.worldStateDBLazyPath.concat(`-block-${treeIssueAtBlockId - 1}-broken-${currentDateString}`);
            logger.info(`rename dir of original worldStateDBLazy to ${migrateDir}...`);
            fs.renameSync(config.worldStateDBLazyPath, migrateDir);
            logger.info(`rename dir of rebuildWorldStateDBLazy to ${config.worldStateDBLazyPath}...`);
            fs.renameSync(rebuildWorldStateDBLazyPath, config.worldStateDBLazyPath);

            logger.info(`re-open new WorldStateDB...`);
            await rebuildWorldStateDBLazy.open();

            logger.info(`change pointer to new WorldStateDB...`);
            this.worldState.worldStateDBLazy = rebuildWorldStateDBLazy;

            logger.info(`rebuild ${MerkleTreeId[treeId]} done.`);

            logger.info(`rebuild WorldStateDBLazy end.`);
        } catch (err) {
            logger.error(err);

            await rebuildWorldStateDBLazy.rollback();

            throw err;
        }
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
