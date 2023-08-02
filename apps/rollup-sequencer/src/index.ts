import { FastifyCore } from './app'
import { parentPort, Worker } from "worker_threads";
import { FLowTask, FlowTaskType, RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { AccountUpdate, fetchTransactionStatus, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, UInt32, UInt64 } from 'snarkyjs';

const sequencer = async () => {
    // init Mina tool
    const isLocalBlockChain = false;// TODO get it from config here
    const Blockchain = isLocalBlockChain ? Mina.LocalBlockchain({ proofsEnabled: true }) : Mina.Network({
        mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
        archive: 'https://archive.berkeley.minaexplorer.com/',
    });
    Mina.setActiveInstance(Blockchain);

    // init leveldb
    const worldStateDB = new WorldStateDB(config.worldStateDBPath);
    // check if network initialze
    if (config.networkInit == 0) {
        worldStateDB.initTrees();
    } else {
        worldStateDB.loadtrees();
    }

    // init IndexDB
    const indexDB = new IndexDB(config.indexedDBPath);

    // init mysqlDB
    const rollupDB = new RollupDB();
    rollupDB.start();

    // construct WorldState
    const worldState = new WorldState(worldStateDB, rollupDB);

    // init worker thread A
    let worker = new Worker('./web-server.js');
    worker.on('online', () => {
        console.log('web-server worker is online...');

    })

    worker.on('exit', (exitCode: number) => {
        // TODO
        // create a new worker for http-server
        //
        //
        //
    })

    worker.on('message', (value: FLowTask) => {
        worldState.handleFlowTask(value);
    })

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

sequencer()
