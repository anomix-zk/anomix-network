import { Worker } from "worker_threads";
import { RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { FastifyCore } from "./app";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('web-server');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

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
}

// init IndexDB
const indexDB = new IndexDB(config.depositIndexedDBPath);// for cache
logger.info('indexDB started.');

// init mysqlDB
const rollupDB = new RollupDB();
await rollupDB.start();
logger.info('rollupDB started.');

// construct WorldState
const worldState = new WorldState(worldStateDB, rollupDB, indexDB);
logger.info('worldState prepared done.');

// start server!
const app = new FastifyCore()
app.server.decorate('worldState', worldState);
await app.listen();
