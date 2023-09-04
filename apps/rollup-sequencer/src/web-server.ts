import { FastifyCore } from './app'
import { WorldStateDB, RollupDB, IndexDB, WorldState } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { WithdrawDB } from './worldstate/withdraw-db';
import fs from "fs";
import { MerkleTreeId } from '@anomix/types';

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init mysqlDB
const rollupDB = new RollupDB();
rollupDB.start();

// init IndexDB
const indexDB = new IndexDB(config.indexedDBPath);

const existDB = fs.existsSync(config.worldStateDBPath);
const worldStateDB = new WorldStateDB(config.worldStateDBPath);
if (!existDB) {
    await worldStateDB.initTrees();

    // prepare data_tree root into indexDB & dataTreeRootsTree
    const dataTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false);
    const index = worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);// 0n
    await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, [dataTreeRoot]);
    await indexDB.put(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${dataTreeRoot.toString()}`, `${index}`);// '0'

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
