import type { AnomixSdk, SdkConfig } from "@anomix/sdk";
import { expose } from "comlink";
import { log } from "../utils";

let syncerSdk: AnomixSdk;

const syncerWrapper = {
    startSyncer: async (config: SdkConfig) => {
        log("create syncer...");
        const { createAnomixSdk } = await import("@anomix/sdk");
        log("syncer loaded");

        syncerSdk = await createAnomixSdk(config);
        await syncerSdk.start(false);

        log("syncer created");
    },

    stopSyncer: async () => {
        log("stop syncer...");

        await syncerSdk.stop();
    },
    syncerRemoveAccount: async (accountPk: string) => {
        await syncerSdk.syncerRemoveAccount(accountPk);
    },
    removeUserState: async (accountPk: string) => {
        await syncerSdk.removeUserState(accountPk);
    },
    addAccount: async (
        accountPrivateKey58: string,
        pwd: string,
        signingPrivateKey1_58: string | undefined,
        signingPrivateKey2_58: string | undefined,
        alias: string | undefined,
    ) => {
        const { PrivateKey } = await import("o1js");
        const accountPrivateKey = PrivateKey.fromBase58(accountPrivateKey58);
        const signingPrivateKey1 = signingPrivateKey1_58
            ? PrivateKey.fromBase58(signingPrivateKey1_58)
            : undefined;
        const signingPrivateKey2 = signingPrivateKey2_58
            ? PrivateKey.fromBase58(signingPrivateKey2_58)
            : undefined;

        return await syncerSdk.addAccount(
            accountPrivateKey,
            pwd,
            signingPrivateKey1,
            signingPrivateKey2,
            alias,
        );
    },
    loginAccount: async (accountPk: string, pwd: string, alias?: string) => {
        return await syncerSdk.loginAccount(accountPk, pwd, alias);
    },

    lockKeyStore: () => {
        syncerSdk.lockKeyStore();
    },

    isAccountSynced: async (accountPk58: string) => {
        return await syncerSdk.isAccountSynced(accountPk58);
    },
};

//onconnect = (e: any) => expose(sdkWrapper, e.ports[0]);

expose(syncerWrapper);

export type SyncerWrapper = typeof syncerWrapper;
