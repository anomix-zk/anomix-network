import consola from 'consola';
import { PublicKey } from 'snarkyjs';
import { AnomixSdk } from './anomix_sdk';
import { getDb } from './database/get_db';
import { SdkOptions } from './sdk_options';

export async function createAnomixSdk(
  entryContractAddress: string,
  options: SdkOptions
) {
  const log = consola.withTag('anomix:create_sdk');
  if (options.debug) {
    consola.level = 4;
  }
  log.info('Creating Anomix SDK...');
  const db = await getDb();

  const sdk = new AnomixSdk(
    db,
    PublicKey.fromBase58(entryContractAddress),
    options
  );

  log.info('Anomix SDK created');

  return sdk;
}
