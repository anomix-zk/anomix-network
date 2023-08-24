import { threadId, Worker } from "worker_threads";
import { activeMinaInstance } from "@anomix/utils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('deposit-processor');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function bootFetchActionEventsThread() {
    // init worker thread A
    let worker = new Worker(`${__dirname}/fetch-actions-events.js`);// TODO
    worker.on('online', () => {
        logger.info('fetch-actions-events worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        logger.info('fetch-actions-events worker exited...');
        bootFetchActionEventsThread();
    })
}

function bootRollupProofWatcherThread() {
    // init worker thread B
    let worker = new Worker(`${__dirname}/deposit-rollup-proof-watcher.js`);// TODO
    worker.on('online', () => {
        logger.info('deposit-rollup-proof-watcher worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        bootRollupProofWatcherThread();
    })
}

function bootWebServerThread() {
    // init worker thread C
    let worker = new Worker(`${__dirname}/web-server.js`);// TODO
    worker.on('online', () => {
        logger.info('web-server worker is online...');
    })

    worker.on('exit', (exitCode: number) => {
        bootWebServerThread();
    })
}

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// start fetching...
bootFetchActionEventsThread();

// start watch...
// bootRollupProofWatcherThread();

// start web-server...
// bootWebServerThread();
