import { getLogger } from './lib/logUtils';

import { FastifyCore } from './app'
import { WorldStateDB, RollupDB, IndexDB, WorldState } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { WithdrawDB } from './worldstate/withdraw-db';
import fs from "fs";
import { BlockCacheType, MerkleTreeId } from '@anomix/types';
import { DataRootWitnessData } from '@anomix/circuits';
import { Field } from "o1js";
import { getConnection } from 'typeorm';
import { Block, BlockCache } from '@anomix/dao';
import debug from 'debug';
import { LeafData } from '@anomix/merkle-tree';

const logger = getLogger('web-server');

const log = debug('anomix:web-server');

log('======================================================================================================');
log('======================================================================================================');
log('======================================================================================================');
log('======================================================================================================');
log('======================================================================================================');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init mysqlDB
const rollupDB = new RollupDB();
await rollupDB.start();

// init IndexDB
const indexDB = new IndexDB(config.indexedDBPath);

// init worldStateDBLazy
const existDBLazy = fs.existsSync(config.worldStateDBLazyPath);// must check ahead of connecting levelDB!
const worldStateDBLazy = new WorldStateDB(config.worldStateDBLazyPath);
if (!existDBLazy) {
    logger.info(`worldStateDBLazyPath is not existing`)
    await worldStateDBLazy.initTrees();
    logger.info(`worldStateDBLazy.initTrees done.`);
} else {
    await worldStateDBLazy.loadTrees();
    logger.info(`worldStateDBLazy.loadTrees done.`);
}

const connection = getConnection();
const blockRepository = await connection.getRepository(Block);
let latestBlock: Block = undefined as any;

// init worldStateDB
const existDB = fs.existsSync(config.worldStateDBPath);// must check ahead of connecting levelDB!
const worldStateDB = new WorldStateDB(config.worldStateDBPath);
if (!existDB) {
    logger.info(`worldStateDBPath is not existing`)

    if (config.networkStatus != 'SIMULATING_PRODUCTION') {// if dev are simulating production to make issues debug, then no need resetDB.
        // reset mysql db
        await rollupDB.resetDB();
    }
    await worldStateDB.initTrees();
    logger.info(`worldStateDB.initTrees done.`);

    // prepare data_tree root into indexDB & dataTreeRootsTree
    const dataTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false);
    logger.info(`the initial dataTreeRoot: ${dataTreeRoot.toString()}`);
    const index = worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);// 0n
    await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, [dataTreeRoot]);
    await worldStateDB.commit();
    logger.info(`append the initial dataTreeRoot into DATA_TREE_ROOTS_TREE at index:${index}, done.`);
    await indexDB.put(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${dataTreeRoot.toString()}`, `${index.toString()}`);// '0'

    /*
    // simulate nullifier-tree appendLeaves as each Block.
    const blockCacheList = await connection.getRepository(BlockCache).find({ where: { type: BlockCacheType.NULLIFIER_TREE_UPDATES }, order: { blockId: 'ASC' } });
    let nullifierTreeCursor = worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, false);
    for (let i = 0; i < blockCacheList.length; i++) {
        const blockCache = blockCacheList[i];
        logger.info(`start appendLeaves of blockId: ${blockCache.blockId}`);
        const nullifierList = (JSON.parse(blockCache.cache) as string[]).map(b => Field(b));

        for (let j = 0; j < nullifierList.length; j++) {
            const nullifier = nullifierList[j];
            logger.info(`start process nullifier: ${nullifier}`);
            logger.info(`nullifierTreeCursor: ${nullifierTreeCursor}`);
            let tx1LowLeafWitness = await worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(nullifier), true);
            logger.info(`tx1LowLeafWitness: ${JSON.stringify(tx1LowLeafWitness)}`);

            const predecessorLeafData = tx1LowLeafWitness.leafData;
            const predecessorIdx = tx1LowLeafWitness.index.toBigInt();

            // modify predecessor                
            logger.info(`before modify predecessor, nullifierTree Root: ${await worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
            logger.info(`before modify predecessor, nullifierTree Num: ${await worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
            const modifiedPredecessorLeafDataTmp: LeafData = {
                value: predecessorLeafData.value.toBigInt(),
                nextValue: Field(nullifier).toBigInt(),
                nextIndex: nullifierTreeCursor
            };
            await worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
            logger.info(`after modify predecessor, nullifierTree Root: ${await worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
            logger.info(`after modify predecessor, nullifierTree Num: ${await worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

            // obtain tx1OldNullWitness
            let tx1OldNullWitness = await worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            logger.info(`tx1OldNullWitness: ${JSON.stringify(tx1OldNullWitness)}`);

            // revert predecessor
            const revertedPredecessorLeafDataTmp: LeafData = {
                value: predecessorLeafData.value.toBigInt(),
                nextValue: predecessorLeafData.nextValue.toBigInt(),
                nextIndex: predecessorLeafData.nextIndex.toBigInt()
            };
            await worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
            logger.info(`after revert predecessor, nullifierTree Root: ${await worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
            logger.info(`after revert predecessor, nullifierTree Num: ${await worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

            // insert nullifier
            await worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(nullifier));
            logger.info('insert nullifier, done.');

            nullifierTreeCursor += 1n;
            logger.info(`after appendLeaf, nullifierTreeCursor: ${nullifierTreeCursor}`);
        }
        await worldStateDB.commit();
        logger.info(`end appendLeaves of blockId: ${blockCache.blockId}`);
    }
    */
} else {
    await worldStateDB.loadTrees();
    logger.info(`worldStateDB.loadTrees done.`);

    /*
    console.log(`=====================================================================`);
    console.log(`生产上SYNC_DATA_TREE root: ${worldStateDB.getRoot(MerkleTreeId.SYNC_DATA_TREE, false)}`);

    console.log(`iterate 生产上SYNC_DATA_TREE...`);
    for (let i = 0; i < worldStateDB.getNumLeaves(MerkleTreeId.SYNC_DATA_TREE, false); i++) {
        const element = await worldStateDB.getLeafValue(MerkleTreeId.SYNC_DATA_TREE, BigInt(i), false);
        console.log(`${i}: ${element?.toString()}`);
    }
    console.log(`=====================================================================`);
    */

    /*
      Since mysql.db, three merkle trees and indexDB are different db and cannot manage them into the same transaction during Rollup-Seq,
      we need to consider solutions for the unexpected case where process crashes after mysqlDB.commit before commit three merkle trees && indexDB.
      Here each time the network reboot, will check if all leveldb are aligned with mysqlDB. 
    */

    // query latest block
    latestBlock = (await blockRepository.find({
        order: {
            id: 'DESC'
        },
        take: 1
    }))[0];
}

// take a check if the trees are aligned with mysqlDB, if not then sync them now.
if (latestBlock) {// skip some existing blocks!
    const latestBlockIdInIndexDB: number = await indexDB.get('LATESTBLOCK');

    // During rollup-seq, indexDB stores 'LATESTBLOCK' after committing worldState, 
    //   thus all merkle trees of the blocks ahead of latestBlockIdInIndexDB has been synced already.
    if (latestBlockIdInIndexDB < latestBlock.id) {// less then 
        logger.info(`latestBlockId(${latestBlockIdInIndexDB}) in IndexDB is less than MysqlDB.latestBlock.id(${latestBlock.id})`);
        logger.info(`start syncing trees...`);
        const blockCacheRepo = await connection.getRepository(BlockCache);

        logger.info(`start sync DATA_TREE...`);
        // calc which block's dataTreeRoot0 == data_tree root
        const dataTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).toString();
        logger.info(`DATA_TREE's root is ${dataTreeRoot}`);

        const block0 = (await blockRepository.findOne({
            where: {
                dataTreeRoot1: dataTreeRoot
            }
        }));
        if (!block0) {
            logger.error(`cannot find the target block by DATA_TREE's root`);

            throw new Error("sync DATA_TREE failed when restart network!!");
        }
        for (let index = block0.id + 1; index <= latestBlock.id; index++) {
            logger.info(`sync DATA_TREE at blockId=${index}`);

            const cache0 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.DATA_TREE_UPDATES
                }
            });
            if (!cache0) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync DATA_TREE failed when restart network: blockCache is undefined");
            }
            if (!cache0.cache || cache0.cache == '[]') {
                logger.info(`blockCache.cache is ${cache0.cache} !`);

                throw new Error("sync DATA_TREE failed when restart network: blockCache.cache is []");
            }
            const cachedUpdatesDataTree = (JSON.parse(cache0!.cache) as string[]).map(c => Field(c));
            await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE, cachedUpdatesDataTree);
            await worldStateDB.commit();

            logger.info(`sync DATA_TREE at blockId=${index}, done.`);
        }
        logger.info(`sync DATA_TREE done.`);


        logger.info(`start sync NULLIFIER_TREE...`);
        // calc which block's nullifierTreeRoot0 == nullifier_tree root
        const nullifierTreeRoot = worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, false).toString();
        logger.info(`NULLIFIER_TREE's root is ${dataTreeRoot}`);

        const block1 = (await blockRepository.findOne({
            where: {
                nullifierTreeRoot1: nullifierTreeRoot
            }
        }));
        if (!block1) {
            logger.error(`cannot find the target block by NULLIFIER_TREE's root`);

            throw new Error("sync NULLIFIER_TREE failed when restart network!!");
        }
        for (let index = block1.id + 1; index <= latestBlock.id; index++) {
            logger.info(`sync NULLIFIER_TREE at blockId=${index}`);

            const cache1 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.NULLIFIER_TREE_UPDATES
                }
            });
            if (!cache1) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync NULLIFIER_TREE failed when restart network: blockCache is undefined");
            }
            if (!cache1.cache || cache1.cache == '[]') {
                logger.info(`blockCache.cache is ${cache1.cache} !`);

                throw new Error("sync NULLIFIER_TREE failed when restart network: blockCache.cache is []");
            }
            const cachedUpdatesNullifierTree = (JSON.parse(cache1!.cache) as string[]).map(c => Field(c));
            await worldStateDB.appendLeaves(MerkleTreeId.NULLIFIER_TREE, cachedUpdatesNullifierTree);
            await worldStateDB.commit();

            logger.info(`sync NULLIFIER_TREE at blockId=${index}, done.`);
        }
        logger.info(`sync NULLIFIER_TREE done.`);



        logger.info(`start sync DATA_TREE_ROOTS_TREE...`);
        // calc which block's rootTreeRoot0 == root_tree root
        const rootTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString();
        logger.info(`DATA_TREE_ROOTS_TREE's root is ${dataTreeRoot}`);
        const block2 = (await blockRepository.findOne({
            where: {
                rootTreeRoot1: rootTreeRoot
            }
        }));
        if (!block2) {
            logger.error(`cannot find the target block by DATA_TREE_ROOTS_TREE's root`);

            throw new Error("sync DATA_TREE_ROOTS_TREE failed when restart network!!");
        }
        for (let index = block2.id + 1; index <= latestBlock.id; index++) {
            logger.info(`sync DATA_TREE_ROOTS_TREE at blockId=${index}`);

            const cache2 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.DATA_TREE_ROOTS_TREE_UPDATES
                }
            });
            if (!cache2) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync DATA_TREE_ROOTS_TREE failed when restart network: blockCache is undefined");
            }
            if (!cache2.cache || cache2.cache == '[]') {
                logger.info(`blockCache.cache is ${cache2.cache} !`);

                throw new Error("sync DATA_TREE_ROOTS_TREE failed when restart network: blockCache.cache is []");
            }
            const cachedUpdatesRootTree = (JSON.parse(cache2.cache) as string[]).map(c => Field(c));
            await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, cachedUpdatesRootTree);
            await worldStateDB.commit();

            logger.info(`sync DATA_TREE_ROOTS_TREE at blockId=${index}, done.`);
        }
        logger.info(`sync DATA_TREE_ROOTS_TREE done.`);


        logger.info(`start sync IndexDB...`);
        // sync with indexDB
        for (let index = latestBlockIdInIndexDB; index <= latestBlock.id; index++) {
            logger.info(`start syncing IndexDB at blockId=(${index})`);

            const cache3 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.INDEXDB_UPDATES
                }
            });
            if (!cache3) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync INDEXDB failed when restart network: blockCache is undefined");
            }
            if (!cache3.cache || cache3.cache == '[]') {
                logger.info(`blockCache.cache is ${cache3.cache} !`);

                throw new Error("sync INDEXDB failed when restart network: blockCache.cache is []");
            }
            const cachedUpdatesIndexDB = JSON.parse(cache3.cache);
            await indexDB.batchInsert(cachedUpdatesIndexDB);

            logger.info(`sync IndexDB at blockId=${index}, done.`);
        }
        logger.info(`sync IndexDB done.`);

    }
}


logger.info(`current network state:{`);
// print network state
logger.info(`  latest blockHeight: ${(latestBlock?.id) ?? 0}`);
//
//
//

// print tree info
logger.info(`treeId: DATA_TREE`);
logger.info(`  depth: ${worldStateDB.getDepth(MerkleTreeId.DATA_TREE)}`);
logger.info(`  leafNum: ${worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).toString()}`)

logger.info(`treeId: SYNC_DATA_TREE`);
logger.info(`  depth: ${worldStateDBLazy.getDepth(MerkleTreeId.DATA_TREE)}`);
logger.info(`  leafNum: ${worldStateDBLazy.getNumLeaves(MerkleTreeId.DATA_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDBLazy.getRoot(MerkleTreeId.DATA_TREE, false).toString()}`)

logger.info(`treeId: NULLIFIER_TREE`);
logger.info(`  depth: ${worldStateDB.getDepth(MerkleTreeId.NULLIFIER_TREE)}`);
logger.info(`  leafNum: ${worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, false).toString()}`)

logger.info(`treeId: DATA_TREE_ROOTS_TREE`);
logger.info(`  depth: ${worldStateDB.getDepth(MerkleTreeId.DATA_TREE_ROOTS_TREE)}`);
logger.info(`  leafNum: ${worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString()}`)

logger.info(`}`);

// construct WorldState
const worldState = new WorldState(worldStateDBLazy, worldStateDB, rollupDB, indexDB);

const withdrawDB = new WithdrawDB(config.withdrawDBPath);

const app = new FastifyCore()
app.server.decorate('worldState', worldState);
app.server.decorate('withdrawDB', withdrawDB);

await app.listen()
