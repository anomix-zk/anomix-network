import { FastifyCore } from './app'
import { WorldStateDB, RollupDB, IndexDB, WorldState } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { WithdrawDB } from './worldstate/withdraw-db';
import fs from "fs";
import { MerkleTreeId } from '@anomix/types';
import { DataRootWitnessData } from '@anomix/circuits';
import { Field } from "o1js";

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init mysqlDB
const rollupDB = new RollupDB();
await rollupDB.start();

// init IndexDB
const indexDB = new IndexDB(config.indexedDBPath);

const existDB = fs.existsSync(config.worldStateDBPath);
const worldStateDB = new WorldStateDB(config.worldStateDBPath);
if (!existDB) {
    if (config.networkStatus != 'SIMULATING_PRODUCTION') {// if dev are simulating production to make issues debug, then no need resetDB.
        // reset mysql db
        await rollupDB.resetDB();
    }
    await worldStateDB.initTrees();

    // prepare data_tree root into indexDB & dataTreeRootsTree
    const dataTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false);
    const index = worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);// 0n
    await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, [dataTreeRoot]);
    await worldStateDB.commit();
    await indexDB.put(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${dataTreeRoot.toString()}`, `${index.toString()}`);// '0'

} else {
    await worldStateDB.loadTrees();
}

// construct WorldState
const worldState = new WorldState(worldStateDB, rollupDB, indexDB);

const withdrawDB = new WithdrawDB(config.withdrawDBPath);

const app = new FastifyCore()
app.server.decorate('worldState', worldState);
app.server.decorate('withdrawDB', withdrawDB);

await app.listen()
