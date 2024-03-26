import { getLogger } from "@/lib/logUtils";
import cp from "child_process";
import { Worker as WorkerThread } from "worker_threads";
import { RollupTaskType } from "@anomix/types";
import { WorldState, WorldStateDB, RollupDB, IndexDB } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import * as rollupSeqHandlerList from "./handlers/rollupSeqHandler";

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

} else {
    await worldStateDB.loadTrees();
    logger.info(`worldStateDB.loadTrees done.`);
}

// construct WorldState
const worldState = new WorldState(worldStateDBLazy, worldStateDB, rollupDB, indexDB);
const withdrawDB = new WithdrawDB(config.withdrawDBPath);

const PROTO_PATH = __dirname + './protos/rollup-seq.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const rollupSeq = grpc.loadPackageDefinition(packageDefinition).rollupSeq;
function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(rollupSeq.RollupSeq.service, {
        queryTxByNullifier: rollupSeqHandlerList.queryTxByNullifier,
        withdrawAsset: rollupSeqHandlerList.withdrawAsset,
        checkPoint: rollupSeqHandlerList.checkPoint,
        proofCallback: rollupSeqHandlerList.proofCallback,
        rollupProofTrigger: rollupSeqHandlerList.rollupProofTrigger,
        triggerStartNewFlow: rollupSeqHandlerList.triggerStartNewFlow,
        checkCommitmentsExist: rollupSeqHandlerList.checkCommitmentsExist,
        checkDataRootsExist: rollupSeqHandlerList.checkDataRootsExist,
        checkNullifiersExist: rollupSeqHandlerList.checkNullifiersExist,
        syncUserWithdrawedNotes: rollupSeqHandlerList.syncUserWithdrawedNotes,
        queryWorldStateworldState: rollupSeqHandlerList.queryWorldStateworldState,
        queryNetworkMetaData: rollupSeqHandlerList.queryNetworkMetaData,
        appendTreeByHand: rollupSeqHandlerList.appendTreeByHand,
        appendUserNullifierTreeByHand: rollupSeqHandlerList.appendUserNullifierTreeByHand,
        queryMerkleProof: rollupSeqHandlerList.queryMerkleProof
    });
    return server;
}

