export const SDK_BROADCAST_CHANNNEL_NAME = 'anomix_sdk';

export enum SdkEventType {
  // An account's state has changed.
  UPDATED_ACCOUNT_STATE = 'SDKEVENT_UPDATED_ACCOUNT_STATE',

  // The syncer's state has changed.
  UPDATED_SYNCER_STATE = 'SDKEVENT_UPDATED_SYNCER_STATE',

  // The sdk has been started.
  STARTED = 'SDKEVENT_STARTED',

  // The sdk has been stopped.
  STOPPED = 'SDKEVENT_STOPPED',
}
