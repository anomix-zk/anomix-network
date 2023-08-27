import cp from "child_process";
import { Worker as WorkerThread } from "worker_threads";
import { RollupTaskType } from "@anomix/types";
import { WorldState, WorldStateDB, RollupDB, IndexDB } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = getLogger('rollup-sequencer');

class ProofSchedulerWorkers extends Array<{ status: number, worker: cp.ChildProcess }> {
    private cursor: number

    constructor(num: number) {
        super(num);

        // start proof-scheduler in worker thread
        while (num > 0) {
            this.bootProofSchedulerThread();
            num--;
        }
    }

    bootProofSchedulerThread() {
        // init worker thread
        const worker = cp.fork(`${__dirname}/prover.js`, ['child']);
        worker.on('online', () => {
            logger.info('proof-scheduler worker is online...');
        })

        worker.on('exit', (exitCode: number) => {
            this.rid(worker);

            // create a new worker for ProofScheduler
            this.bootProofSchedulerThread();
        })

        this.push({ status: 0, worker });
    }

    rid(worker: cp.ChildProcess) {
        const index = this.findIndex((t, i) => {
            return t.worker == worker;
        });

        this.splice(index, 1);
    }

    exec(task: any) {
        const freeWorkers = this.filter(t => {
            return t.status == 0;
        });

        if (freeWorkers.length == 0) {// if no free workers, then distribute task as order
            const i = (this.cursor++) % config.proofSchedulerWorkerNum;
            this[i].status = 1;
            this[i].worker.send(task);
            return;
        }

        freeWorkers[0].status = 1;
        freeWorkers[0].worker.send(task);
    }
}


// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

if (process.argv[2] != 'child') {

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

    // start proof-scheduler workers
    let proofSchedulerWorkers = new ProofSchedulerWorkers(config.proofSchedulerWorkerNum);

    const bootWebServerThread = (worldState: WorldState) => {
        // init worker thread A
        // let worker = new WorkerThread(`${__dirname}/web-server.js`);
        let worker = cp.fork(`${__dirname}/web-server.js`, ['child']);
        worker.on('online', () => {
            logger.info('web-server worker is online...');
        })

        worker.on('exit', (exitCode: number) => {
            // create a new worker for http-server
            bootWebServerThread(worldState);
        })

        worker.on('message', (value: any) => {
            if (value.taskType == RollupTaskType.SEQUENCE) {// trigger seq
                // if (worldState.ongingFlow) {// single thread for 'seq', no need check!
                //     return;
                // }
                worldState.startNewFlow();
                return;
            }
            // dispatch to 'proof-scheduler' worker
            proofSchedulerWorkers.exec(value);
        })
    }

    // start web server in worker thread 
    // bootWebServerThread(worldState);

}
