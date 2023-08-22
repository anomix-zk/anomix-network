import { Worker } from "worker_threads";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { FastifyCore } from './app'
import { activeMinaInstance } from "@anomix/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workerMap = new Map<string, Worker>();

function bootTaskTracerThread() {
    // init worker thread A
    const worker = new Worker(`${__dirname}/task-tracer.js`);// TODO
    worker.on('online', () => {
        console.log('task-tracer is online...');
    })

    worker.on('exit', (exitCode: number) => {
        // create a new worker for http-server
        bootTaskTracerThread();
    })

    workerMap.set('TaskTracer', worker);
}

function bootMempoolWatcherThread() {
    // init worker thread A
    const worker = new Worker(`${__dirname}/mempool-watcher.js`);// TODO
    worker.on('online', () => {
        console.log('mempool-watcher is online...');
    })

    worker.on('exit', (exitCode: number) => {
        // create a new worker for http-server
        bootMempoolWatcherThread();
    })

    workerMap.set('MempoolWatcher', worker);
}

function bootProofTriggerThread() {
    // init worker thread A
    const worker = new Worker(`${__dirname}/proof-trigger.js`);// TODO
    worker.on('online', () => {
        console.log('proof-trigger is online...');
    })

    worker.on('exit', (exitCode: number) => {
        // create a new worker for http-server
        bootProofTriggerThread();
    })

    workerMap.set('ProofTrigger', worker);
}

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

bootTaskTracerThread();

bootProofTriggerThread();

bootMempoolWatcherThread();

const app = new FastifyCore();
app.server.decorate('workerMap', workerMap);
await app.listen();
