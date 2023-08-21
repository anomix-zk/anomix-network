import { Worker } from "worker_threads";
import { RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { FastifyCore } from "./app";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function bootFetchActionEventsThread() {
    // init worker thread A
    let worker = new Worker(`${__dirname}/fetch-actions-events.js`);// TODO
    worker.on('online', () => {
        console.log('fetch-actions-events worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        bootFetchActionEventsThread();
    })
}

function bootRollupProofWatcherThread() {
    // init worker thread B
    let worker = new Worker(`${__dirname}/deposit-rollup-proof-watcher.js`);// TODO
    worker.on('online', () => {
        console.log('deposit-rollup-proof-watcher worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        bootRollupProofWatcherThread();
    })
}
// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init leveldb for deposit state
const worldStateDB = new WorldStateDB(config.depositWorldStateDBPath);
// check if network initialze
if (config.networkInit == 0) {
    worldStateDB.initTrees();
} else {
    worldStateDB.loadTrees();
}

// init IndexDB
const indexDB = new IndexDB(config.indexedDBPath);// for cache

// init mysqlDB
const rollupDB = new RollupDB();
rollupDB.start();

// construct WorldState
const worldState = new WorldState(worldStateDB, rollupDB, indexDB);

// start fetching...
bootFetchActionEventsThread();

// start watch...
bootRollupProofWatcherThread();

// start server!
const app = new FastifyCore()
app.server.decorate('worldState', worldState);
await app.listen();
