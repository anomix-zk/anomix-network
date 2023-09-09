import type { AnomixSdk, SdkConfig } from "@anomix/sdk";
import { expose } from "comlink";
import { tryFunc, log } from "../utils";

let syncerSdk: AnomixSdk;
//const logLabel = "sdk_worker";
// const chan = new BroadcastChannel(CHANNEL_LOG);

// Use syncer related methods from the SDK
const syncerWrapper = {
    startSyncer: async (config: SdkConfig) => {
        log("create syncer...");
        const { createAnomixSdk } = await import("@anomix/sdk");
        log("syncer loaded");

        await tryFunc(async () => {
            syncerSdk = await createAnomixSdk(config);
            await syncerSdk.start(false);
        });
        log("syncer created");
    },

    stopSyncer: async () => {
        log("stop syncer...");

        await tryFunc(async () => {
            await syncerSdk.stop();
        });
    },

    addAccount: async (
        accountPrivateKey58: string,
        pwd: string,
        signingPrivateKey1_58: string | undefined,
        signingPrivateKey2_58: string | undefined,
        alias: string | undefined
    ) => {
        return await tryFunc(async () => {
            const { PrivateKey } = await import("snarkyjs");
            const accountPrivateKey =
                PrivateKey.fromBase58(accountPrivateKey58);
            const signingPrivateKey1 = signingPrivateKey1_58
                ? PrivateKey.fromBase58(signingPrivateKey1_58)
                : undefined;
            const signingPrivateKey2 = signingPrivateKey2_58
                ? PrivateKey.fromBase58(signingPrivateKey2_58)
                : undefined;

            const accountPk = await syncerSdk.addAccount(
                accountPrivateKey,
                pwd,
                signingPrivateKey1,
                signingPrivateKey2,
                alias
            );
            return accountPk.toBase58();
        });
    },

    // unlockKeyStore: async (cachedPubKeys: string[], pwd: string) => {
    //     await syncerSdk.unlockKeyStore(cachedPubKeys, pwd);
    // },

    isAccountSynced: async (accountPk58: string) => {
        return await syncerSdk.isAccountSynced(accountPk58);
    },
};

//onconnect = (e: any) => expose(sdkWrapper, e.ports[0]);

expose(syncerWrapper);

export type SyncerWrapper = typeof syncerWrapper;
