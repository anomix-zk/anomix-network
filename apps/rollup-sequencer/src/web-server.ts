import { FastifyCore } from './app'
import { parentPort } from "worker_threads";
import { FLowTask, FlowTaskType, RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from "@/lib/config";
import { activeMinaInstance } from "@anomix/utils";
import { AccountUpdate, fetchTransactionStatus, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, UInt32, UInt64 } from 'snarkyjs';

const server = async () => {
    // init Mina tool
    await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

    // init leveldb
    const worldStateDB = new WorldStateDB(config.worldStateDBPath);
    worldStateDB.loadTrees();// just need load!

    // init IndexDB
    const indexDB = new IndexDB(config.indexedDBPath);

    const app = new FastifyCore()
    app.server.decorate('worldStateDB', worldStateDB);
    app.server.decorate('indexDB', indexDB);

    const notification = { atRollup: false };
    app.server.decorate('sequencerStatus', notification);

    /*
    parentPort?.on('message', (value: { atRollup: boolean }) => {// TODO should rm it and change to query DB
        notification.atRollup = value.atRollup;
    })
    */

    await app.listen()

    // Highlevel Processing Progress:
    // start pipeline: new instance would be created by last one in 10mins when last one ends.
    // read pipelineTxCount = InnerRollupTxCount * OuterRollupInnerBatchesCount
    // Query mysqlDB: 
    // if pendingTxs is equal/greater than pipelineTxCount,
    // * if there are pending tx on 'deposit', then should rank first,
    // * if there are pending tx on 'account', then should rank second,
    // * filter the x TXes whose tx_fee ranks x.
    // else 
    // * query all pendingTxes and compose PaddingTxes to fill.

    // Begin maintain WorldState:
    // * compose CommonUserTxWrapper for each tx within each batch,
    // * save each batch to MysqlDB,
    // * send signal to start 'proof-generator',
    //   * 'proof-generator' server query them for inner merge,

}

export default server

server()
