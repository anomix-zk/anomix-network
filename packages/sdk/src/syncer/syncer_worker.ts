import consola from 'consola';
import { getDb } from '../database/get_db';
import { PasswordKeyStore } from '../key_store/password_key_store';
import { NodeProvider } from '../rollup_node/node_provider';
import { SdkOptions } from '../sdk_options';
import { Syncer } from './syncer';
import { PublicKey } from 'snarkyjs';

import { parentPort } from 'worker_threads';
import { isNode } from 'detect-node';
import { expose } from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';

let currSyncer: Syncer;
let sdkOptions: SdkOptions;
const log = consola.withTag('anomix:sdk:syncer_worker');

const syncerWrapper = {
  create: async (options: SdkOptions) => {
    log.info('Creating syncer...');
    sdkOptions = options;
    const db = await getDb();
    const node = new NodeProvider(
      options.nodeUrl,
      options.nodeRequestTimeoutMS
        ? options.nodeRequestTimeoutMS
        : 3 * 60 * 1000
    );
    const keyStore = new PasswordKeyStore(db);
    currSyncer = new Syncer(node, db, keyStore);
    log.info('Syncer created');
  },

  start: async () => {
    log.info('Starting syncer...');
    await currSyncer.start(
      1,
      1,
      sdkOptions.l2BlockPollingIntervalMS
        ? sdkOptions.l2BlockPollingIntervalMS
        : 1000
    );
    log.info('Syncer started');
  },

  stop: async () => {
    log.info('Stopping syncer...');
    await currSyncer.stop();
    log.info('Syncer stopped');
  },

  isSynced: async () => {
    log.info('Checking if syncer is synced...');
    return await currSyncer.isSynced();
  },

  isAccountSynced: async (accountPk: string) => {
    log.info('Checking if account is synced...');
    return await currSyncer.isAccountSynced(accountPk);
  },

  isRunning: () => {
    log.info('Checking if syncer is running...');
    return currSyncer.isRunning();
  },

  addAccount: async (accountPk: string) => {
    log.info('Adding account...');
    currSyncer.addAccount(PublicKey.fromBase58(accountPk));
  },
};

export type SyncerWrapper = typeof syncerWrapper;

if (isNode) {
  expose(syncerWrapper, nodeEndpoint(parentPort!));
} else {
  expose(syncerWrapper);
}
