import consola from 'consola';
import { getDb } from '../database/get_db';
import { PasswordKeyStore } from '../key_store/password_key_store';
import { NodeProvider } from '../rollup_node/node_provider';
import { SdkOptions } from '../sdk_options';
import { Syncer } from './syncer';
import { PublicKey } from 'o1js';
//import { parentPort } from 'worker_threads';
import isNode from 'detect-node';
import { expose } from 'comlink';
import { LogEvent } from '../types/types';

let currSyncer: Syncer;
let sdkOptions: SdkOptions;
let channel: BroadcastChannel | null = null;
const logLabel = 'anomix:sdk:syncer_worker';
const clog = consola.withTag(logLabel);

async function tryFunc<T>(func: () => Promise<T>) {
  try {
    return await func();
  } catch (err) {
    clog.error(err);
    log(err);
    throw err;
  }
}

const log = (message: any) => {
  if (channel !== null) {
    channel.postMessage({ label: logLabel, message } as LogEvent);
  }
};

const syncerWrapper = {
  create: async (options: SdkOptions) => {
    clog.info('start syncer worker');
    if (options.logChannelName) {
      channel = new BroadcastChannel(options.logChannelName);
    }
    await tryFunc(async () => {
      clog.info('Creating syncer...');
      log('Creating syncer...');
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
      clog.info('Syncer created');
      log('Syncer created');
    });
  },

  start: async () => {
    await tryFunc(async () => {
      clog.info('Starting syncer...');
      log('Starting syncer...');
      await currSyncer.start(
        1,
        sdkOptions.synceBlocksPerPoll !== undefined
          ? sdkOptions.synceBlocksPerPoll
          : 1,
        sdkOptions.l2BlockPollingIntervalMS
          ? sdkOptions.l2BlockPollingIntervalMS
          : 1000
      );
      clog.info('Syncer started');
      log('Syncer started');
    });
  },

  stop: async () => {
    await tryFunc(async () => {
      clog.info('Stopping syncer...');
      log('Stopping syncer...');
      await currSyncer.stop();
      clog.info('Syncer stopped');
      log('Syncer stopped');
    });
  },

  isSynced: async () => {
    return await tryFunc(async () => {
      clog.info('Checking if syncer is synced...');
      log('Checking if syncer is synced...');
      return await currSyncer.isSynced();
    });
  },

  isAccountSynced: async (accountPk: string) => {
    return await tryFunc(async () => {
      clog.info('Checking if account is synced...');
      log('Checking if account is synced...');
      return await currSyncer.isAccountSynced(accountPk);
    });
  },

  isRunning: async () => {
    return await tryFunc(async () => {
      clog.info('Checking if syncer is running...');
      log('Checking if syncer is running...');
      return currSyncer.isRunning();
    });
  },

  addAccount: async (accountPk: string) => {
    await tryFunc(async () => {
      clog.info('Adding account...');
      log('Adding account...');
      currSyncer.addAccount(PublicKey.fromBase58(accountPk));
    });
  },

  removeAccount: async (accountPk: string) => {
    await tryFunc(async () => {
      clog.info('Removing account...');
      log('Removing account...');
      currSyncer.removeAccount(PublicKey.fromBase58(accountPk));
    });
  },
};

export type SyncerWrapper = typeof syncerWrapper;

if (isNode) {
  // expose(syncerWrapper, nodeEndpoint(parentPort!));
  throw new Error('Worker not supported when is node env');
} else {
  expose(syncerWrapper);
}
