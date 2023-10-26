import { getLogger } from "@/lib/logUtils";

import { Worker } from "worker_threads";
import { RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { FastifyCore } from "./app";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getConnection } from "typeorm";
import { DepositTreeTrans, DepositTreeTransCache } from "@anomix/dao";
import { DepositTransCacheType, MerkleTreeId } from "@anomix/types";
import { Field } from "o1js";

const logger = getLogger('web-server');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init IndexDB
const indexDB = new IndexDB(config.depositIndexedDBPath);// for cache
logger.info('indexDB started.');

// init mysqlDB
const rollupDB = new RollupDB();
await rollupDB.start();
logger.info('rollupDB started.');

// init worldStateDBLazy
const existDBLazy = fs.existsSync(config.depositWorldStateDBLazyPath);
// init leveldb for deposit state
const worldStateDBLazy = new WorldStateDB(config.depositWorldStateDBLazyPath);// leveldown itself will mkdir underlyingly if dir not exists.
if (!existDBLazy) {// check if network initialze
    // init tree
    await worldStateDBLazy.initTrees();
    logger.info('worldStateDBLazy.initTrees completed.');
} else {
    await worldStateDBLazy.loadTrees();
    logger.info('worldStateDBLazy.loadTrees completed.');
}

const connection = getConnection();
const dcTransRepo = await connection.getRepository(DepositTreeTrans);
let latestDcTran: DepositTreeTrans = undefined as any;

const existDB = fs.existsSync(config.depositWorldStateDBPath);
// init leveldb for deposit state
const worldStateDB = new WorldStateDB(config.depositWorldStateDBPath);// leveldown itself will mkdir underlyingly if dir not exists.
if (!existDB) {// check if network initialze
    // init tree
    await worldStateDB.initTrees();
    logger.info('worldStateDB.initTrees completed.');
} else {
    await worldStateDB.loadTrees();
    logger.info('worldStateDB.loadTrees completed.');

    /*
      Since mysql.db, three merkle trees are different db and cannot manage them into the same transaction during Rollup-Seq,
      we need to consider solutions for the unexpected case where process crashes after mysqlDB.commit before commit three merkle trees.
      Here each time the network reboot, will check if all leveldb are aligned with mysqlDB. 
    */

    // query latest block
    latestDcTran = (await dcTransRepo.find({
        order: {
            id: 'DESC'
        },
        take: 1
    }))[0];
}

if (latestDcTran) {
    const depositTreeRoot = worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).toString();

    const dcTran = await dcTransRepo.findOne({
        where: {
            nextDepositRoot: depositTreeRoot
        }
    });

    if (!dcTran) {
        logger.info(`cannot find target dcTran!`);

        throw new Error("sync DEPOSIT_TREE failed when restart network: DepositTreeTrans is undefined");
    }

    logger.info(`start syncing DEPOSIT_TREE...`);
    for (let index = dcTran.id + 1; index <= latestDcTran.id; index++) {
        logger.info(`start syncing DEPOSIT_TREE at dcTranId=${index}`);

        const cacheRepo = connection.getRepository(DepositTreeTransCache);
        await cacheRepo.findOne({
            where: {
                type: DepositTransCacheType.DEPOSIT_TREE_UPDATES,
                dcTransId: index
            }
        }).then(async c => {
            await worldStateDB.appendLeaves(MerkleTreeId.DEPOSIT_TREE, (JSON.parse(c!.cache) as string[]).map(x => Field(x)));

            logger.info(`sync DEPOSIT_TREE at dcTranId=${index}, done.`);
        });
    }
    logger.info(`sync DEPOSIT_TREE done.`);

}

logger.info(`current network state:{`);

// print network state
logger.info(`latestDcTransId: ${latestDcTran?.id}`);
//
//
//

// print tree info
logger.info(`treeId: DEPOSIT_TREE`);
logger.info(`  depth: ${worldStateDB.getDepth(MerkleTreeId.DEPOSIT_TREE)}`);
logger.info(`  leafNum: ${worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).toString()}`)

logger.info(`treeId: SYNC_DEPOSIT_TREE`);
logger.info(`  depth: ${worldStateDBLazy.getDepth(MerkleTreeId.DEPOSIT_TREE)}`);
logger.info(`  leafNum: ${worldStateDBLazy.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDBLazy.getRoot(MerkleTreeId.DEPOSIT_TREE, false).toString()}`)

logger.info(`}`);

// construct WorldState
const worldState = new WorldState(worldStateDBLazy, worldStateDB, rollupDB, indexDB);
logger.info('worldState prepared done.');

// start server!
const app = new FastifyCore()
app.server.decorate('worldState', worldState);
await app.listen();
