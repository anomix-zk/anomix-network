import { FastifyCore } from './app'
import { parentPort, Worker } from "worker_threads";
import { FLowTask, FlowTaskType, RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { AccountUpdate, fetchTransactionStatus, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, UInt32, UInt64 } from 'snarkyjs';

function bootWebServerThread(worldState: WorldState) {
    // init worker thread A
    let worker = new Worker('./web-server.js');
    worker.on('online', () => {
        console.log('web-server worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        // create a new worker for http-server
        bootWebServerThread(worldState);
    })

    worker.on('message', (value: FLowTask<any>) => {
        worldState.handleFlowTask(value);
    })
}

const sequencer = async () => {
    // init Mina tool
    await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

    // init leveldb
    const worldStateDB = new WorldStateDB(config.worldStateDBPath);
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

    // start web server in worker thread
    bootWebServerThread(worldState);

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

sequencer();
