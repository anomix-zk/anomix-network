import { FastifyCore } from './app'
import { parentPort, Worker } from "worker_threads";
import { FLowTask, FlowTaskType, RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance, syncActions } from "@anomix/utils";
import { AccountUpdate, fetchTransactionStatus, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, UInt32, UInt64 } from 'snarkyjs';

import server from "./web-server";

function bootWebServerThread(worldState: WorldState) {
    // init worker thread A
    let worker = new Worker('./fetch-actions-events.js');
    worker.on('online', () => {
        console.log('web-server worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        // create a new worker for http-server
        bootWebServerThread(worldState);
    })

}


const depositProcessor = async () => {
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

    // start server!
    server();

    // start web server in worker thread
    bootWebServerThread(worldState);
    /*
        // start a new rollup each 5mins
        setInterval(async () => {
            await worldState.startNewFlow();
        }, 5 * 60 * 1000);
    */

}

depositProcessor();
