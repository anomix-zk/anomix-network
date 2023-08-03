import consola from 'consola';
import { PublicKey } from 'snarkyjs';
import { AnomixSdk } from './anomix_sdk';
import { getDb } from './database/get_db';
import { KeyStoreInstance } from './key_store/key_store_instance';
import { AnomixNode } from './rollup_node/anomix_node';
import { NodeProvider } from './rollup_node/node_provider';
import { Syncer } from './syncer/syncer';

export type SdkOptions = {
  nodeUrl: string;
  l2BlockPollingIntervalMS?: number;
  debug?: boolean;
};

export async function createAnomixSdk(
  entryContractAddress: string,
  options: SdkOptions
) {
  const node: AnomixNode = new NodeProvider(options.nodeUrl);
  const log = consola.withTag('anomix:sdk');
  if (options.debug) {
    consola.level = 4;
  }

  log.info('Creating Anomix SDK...');
  const db = await getDb();
  const keyStore = new KeyStoreInstance(db);
  const syncer = new Syncer(node, db);

  const sdk = new AnomixSdk(
    keyStore,
    db,
    syncer,
    log,
    node,
    PublicKey.fromBase58(entryContractAddress),
    options.l2BlockPollingIntervalMS
      ? options.l2BlockPollingIntervalMS
      : 3 * 60 * 1000
  );

  await sdk.init();
  log.info('Anomix SDK created');

  return sdk;
}
