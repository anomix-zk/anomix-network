import { getLogger } from "@/lib/logUtils";
import cp from "child_process";
import { Worker as WorkerThread } from "worker_threads";
import { RollupTaskType } from "@anomix/types";
import { WorldState, WorldStateDB, RollupDB, IndexDB } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = getLogger('main');

class ProofSchedulerWorkers extends Array<{ status: number, worker: cp.ChildProcess }> {
    private cursor = 0

    constructor(num: number) {
        super();

        // start proof-scheduler in worker thread
        while (num > 0) {
            this.bootProofSchedulerThread();
            num--;
        }
    }

    bootProofSchedulerThread() {
        // init worker thread
        const worker = cp.fork(`${__dirname}/prover.js`, [`Prover${this.length}`]);
        worker.on('online', () => {
            logger.info('proof-scheduler worker is online...');
        })

        worker.on('message', (v) => {
            if (v == 'done') {
                this.filter(w => w.worker == worker)[0].status = 0;
            }
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

        if (freeWorkers.length == 0) {// if no free workers, then distribute task to subprocess as order
            const i = (this.cursor++) % this.length;
            logger.info(`cursor: ${this.cursor}, this.length: ${this.length}, i: ${i}`);
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

// start proof-scheduler workers
let proofSchedulerWorkers = new ProofSchedulerWorkers(config.proofSchedulerWorkerNum);

const bootWebServerThread = () => {
    // init worker thread A
    // let worker = new WorkerThread(`${__dirname}/web-server.js`);
    let serverProcess = cp.fork(`${__dirname}/web-server.js`, ['WebServer']);
    serverProcess.on('online', () => {
        logger.info('web-server process is online...');
    })

    serverProcess.on('exit', (exitCode: number) => {
        // create a new process for http-server
        bootWebServerThread();
    })

    serverProcess.on('message', (value: any) => {
        // dispatch to 'proof-scheduler' worker
        proofSchedulerWorkers.exec(value);
    })
}

// start web server in worker thread 
bootWebServerThread();
