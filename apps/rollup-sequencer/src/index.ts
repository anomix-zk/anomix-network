import { FastifyCore } from './app'
import { parentPort, Worker } from "worker_threads";
import { FLowTask, FlowTaskType } from "./rollup";
import { WorldState, WorldStateDB } from "./worldstate";

const sequencer = async () => {
    // init leveldb

    // construct WorldState
    let worldState = new WorldState();// TODO

    // init worker thread A
    let worker = new Worker('./web-server.js');
    worker.on('online', () => {
        //
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
