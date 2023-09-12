import consola from 'consola';
import { PublicKey } from 'o1js';
import { AnomixSdk } from './anomix_sdk';
import { getDb } from './database/get_db';
import { SdkConfig, SdkOptions } from './sdk_options';

export async function createAnomixSdk({
  entryContractAddress,
  vaultContractAddress,
  options,
}: SdkConfig) {
  const log = consola.withTag('anomix:create_sdk');
  if (options.debug) {
    consola.level = 4;
  }
  log.info('Creating Anomix SDK...');
  log.debug('config: ', {
    entryContractAddress,
    vaultContractAddress,
    options,
  });
  const db = await getDb();

  const sdk = new AnomixSdk(
    db,
    PublicKey.fromBase58(entryContractAddress),
    PublicKey.fromBase58(vaultContractAddress),
    options
  );

  log.info('Anomix SDK created');

  return sdk;
}
