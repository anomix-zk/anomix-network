import { FastifyCore } from './app'
import { WorldStateDB, RollupDB, IndexDB, WorldState } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { WithdrawDB } from './worldstate/withdraw-db';

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init leveldb
const worldStateDB = new WorldStateDB(config.worldStateDBPath);
worldStateDB.loadTrees();// just need load!

// init mysqlDB
const rollupDB = new RollupDB();
rollupDB.start();

// init IndexDB
const indexDB = new IndexDB(config.indexedDBPath);

// construct WorldState
const worldState = new WorldState(worldStateDB, rollupDB, indexDB);

const withdrawDB = new WithdrawDB(config.withdrawDBPath);

const app = new FastifyCore()
app.server.decorate('worldState', worldState);
app.server.decorate('withdrawDB', withdrawDB);

await app.listen()
