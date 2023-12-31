import { MINA } from '@anomix/circuits';

export const DEFAULT_L1_TX_FEE = 0.03 * MINA;

export const EMPTY_PUBLICKEY =
  'B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKDhKeyBQL9TDb3nvBG';

export enum SdkEventType {
  // An account's state has changed.
  UPDATED_ACCOUNT_STATE = 'SDKEVENT_UPDATED_ACCOUNT_STATE',

  // The syncer's state has changed.
  UPDATED_SYNCER_STATE = 'SDKEVENT_UPDATED_SYNCER_STATE',

  // The sdk has been started.
  STARTED = 'SDKEVENT_STARTED',

  // The sdk has been stopped.
  STOPPED = 'SDKEVENT_STOPPED',

  VAULT_CONTRACT_COMPILED_DONE = 'SDKEVENT_VAULT_CONTRACT_COMPILED_DONE',

  ENTRY_CONTRACT_COMPILED_DONE = 'SDKEVENT_ENTRY_CONTRACT_COMPILED_DONE',

  PRIVATE_CIRCUIT_COMPILED_DONE = 'SDKEVENT_PRIVATE_CIRCUIT_COMPILED_DONE',
}
