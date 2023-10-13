import { SdkConfig } from "@anomix/sdk";
import { Remote, wrap } from "comlink";
import { CHANNEL_LOG, CHANNEL_SYNCER } from "../common/constants";
import { SdkEvent } from "../common/types";
import { ApiWrapper } from "../worker/api_worker";
import type { SdkWrapper } from "../worker/sdk_worker";
import { SyncerWrapper } from "../worker/syncer_worker";

const SdkState = {
    remoteSdk: null as Remote<SdkWrapper> | null,
    sdkWorker: null as Worker | null,
    remoteSyncer: null as Remote<SyncerWrapper> | null,
    syncerWorker: null as Worker | null,
    remoteApi: null as Remote<ApiWrapper> | null,
    apiWorker: null as Worker | null,
};

export type SdkStateType = typeof SdkState;

export default function () {
    const { setSdkExist, setSyncerStarted, setApiExist, resetStatusForLogOut } =
        useStatus();

    const createRemoteSdk = async (config: SdkConfig) => {
        console.log("create remote sdk...");
        if (SdkState.sdkWorker !== null) {
            SdkState.sdkWorker.terminate();
        }

        SdkState.sdkWorker = new Worker(
            new URL("../worker/sdk_worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
        SdkState.remoteSdk = wrap<SdkWrapper>(SdkState.sdkWorker!);
        await SdkState.remoteSdk.createSdk(config);

        setSdkExist(true);
        console.log("remote sdk create success");
    };

    const compileCircuits = () => {
        if (SdkState.remoteSdk === null) {
            throw new Error("remote sdk is null");
        }
        // async compile circuits
        SdkState.remoteSdk.compileCircuits();
    };

    const createRemoteApi = async (config: SdkConfig) => {
        console.log("create remote api...");
        if (SdkState.apiWorker !== null) {
            SdkState.apiWorker.terminate();
        }

        SdkState.apiWorker = new Worker(
            new URL("../worker/api_worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
        SdkState.remoteApi = wrap<ApiWrapper>(SdkState.apiWorker!);
        await SdkState.remoteApi.createApiService(config);

        setApiExist(true);
        console.log("remote api create success");
    };

    const startRemoteSyncer = async (config: SdkConfig) => {
        console.log("create remote syncer...");
        if (SdkState.syncerWorker !== null) {
            SdkState.syncerWorker.terminate();
        }

        SdkState.syncerWorker = new Worker(
            new URL("../worker/syncer_worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
        SdkState.remoteSyncer = wrap<SyncerWrapper>(SdkState.syncerWorker!);
        await SdkState.remoteSyncer.startSyncer(config);

        setSyncerStarted(true);
        console.log("remote syncer create success");
    };

    const addAccount = async (
        accountPrivateKey58: string,
        pwd: string,
        signingPrivateKey1_58: string | undefined,
        signingPrivateKey2_58: string | undefined,
        alias: string | undefined,
    ) => {
        const { accountPk, signingPubKey1, signingPubKey2 } =
            await SdkState.remoteSyncer!.addAccount(
                accountPrivateKey58,
                pwd,
                signingPrivateKey1_58,
                signingPrivateKey2_58,
                alias,
            );
        console.log("useSdk-addAccount: ", accountPk);

        const cachedPubKeys: string[] = [accountPk];
        if (signingPubKey1) {
            cachedPubKeys.push(signingPubKey1);
        }
        if (signingPubKey2) {
            cachedPubKeys.push(signingPubKey2);
        }
        await SdkState.remoteSdk!.unlockKeyStore(cachedPubKeys, pwd);

        return accountPk;
    };

    const loginAccount = async (
        accountPk: string,
        pwd: string,
        alias?: string,
    ) => {
        const { pubKeys } = await SdkState.remoteSyncer!.loginAccount(
            accountPk,
            pwd,
            alias,
        );

        await SdkState.remoteSdk!.unlockKeyStore(pubKeys, pwd);

        return pubKeys;
    };

    const exitAccount = async (accountPk58: string) => {
        console.log("exit account...");
        await SdkState.remoteSdk!.lockKeyStore();
        await SdkState.remoteSyncer!.lockKeyStore();
        await SdkState.remoteSyncer!.syncerRemoveAccount(accountPk58);
        resetStatusForLogOut();
        console.log("exit account success");
    };

    const clearAccount = async (accountPk58: string) => {
        console.log("clear account...");
        await SdkState.remoteSyncer!.removeUserState(accountPk58);
        await exitAccount(accountPk58);
        console.log("clear account success");
    };

    const listenLogChannel = () => {
        const chan = new BroadcastChannel(CHANNEL_LOG);
        chan.onmessage = (ev) => {
            if (ev.data instanceof Error) {
                console.error(ev.data);
            } else {
                console.log(ev.data);
            }
            // console.log(ev.data);
        };
    };

    const listenSyncerChannel = (
        func: (event: SdkEvent, chan: BroadcastChannel) => void,
    ) => {
        console.log("set listenSyncerChannel...");
        const chan = new BroadcastChannel(CHANNEL_SYNCER);
        chan.onmessage = (ev: any) => {
            func(ev.data, chan);
        };
        console.log("set listenSyncerChannel success");
    };

    return {
        SdkState,
        createRemoteSdk,
        listenLogChannel,
        startRemoteSyncer,
        listenSyncerChannel,
        createRemoteApi,
        addAccount,
        exitAccount,
        compileCircuits,
        loginAccount,
        clearAccount,
    };
}
