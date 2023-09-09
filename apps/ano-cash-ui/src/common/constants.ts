export const CHANNEL_LOG = "log";
export const CHANNEL_SYNCER = "syncer";

export const MINA = 1000_000_000;

export enum PageAction {
    SEND_TOKEN = "SEND_TOKEN",
    WITHDRAW_TOKEN = "WITHDRAW_TOKEN",
}

export enum SdkEventType {
    // An account's state has changed.
    UPDATED_ACCOUNT_STATE = "SDKEVENT_UPDATED_ACCOUNT_STATE",

    // The syncer's state has changed.
    UPDATED_SYNCER_STATE = "SDKEVENT_UPDATED_SYNCER_STATE",

    // The sdk has been started.
    STARTED = "SDKEVENT_STARTED",

    // The sdk has been stopped.
    STOPPED = "SDKEVENT_STOPPED",

    VAULT_CONTRACT_COMPILED_DONE = "SDKEVENT_VAULT_CONTRACT_COMPILED_DONE",

    ENTRY_CONTRACT_COMPILED_DONE = "SDKEVENT_ENTRY_CONTRACT_COMPILED_DONE",

    PRIVATE_CIRCUIT_COMPILED_DONE = "SDKEVENT_PRIVATE_CIRCUIT_COMPILED_DONE",
}

export enum AccountStatus {
    REGISTERED = "REGISTERED",
    UNREGISTERED = "UNREGISTERED",
    REGISTERING = "REGISTERING",
}
