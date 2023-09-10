import type { AnomixSdk, ProviderSignature, SdkConfig, Tx } from "@anomix/sdk";
import { expose } from "comlink";
import { log, tryFunc } from "../utils";

let apiSdk: AnomixSdk;
let minaEndpoint: string;
//const logLabel = "sdk_worker";
// const chan = new BroadcastChannel(CHANNEL_LOG);

// Use plain api, network api, db api
const apiWrapper = {
    createApiService: async (config: SdkConfig) => {
        log("create api service...");
        const { createAnomixSdk } = await import("@anomix/sdk");
        log("api service loaded");

        await tryFunc(async () => {
            minaEndpoint = config.options.minaEndpoint;
            apiSdk = await createAnomixSdk(config);
        });
        log("api service created");
    },

    generateKeyPair: async (sign: ProviderSignature, accountIndex = 0) => {
        log("generate key pair: " + JSON.stringify(sign));

        return await tryFunc(async () => {
            const keypair = apiSdk.generateKeyPairByProviderSignature(
                sign,
                accountIndex
            );
            return {
                privateKey: keypair.privateKey.toBase58(),
                publicKey: keypair.publicKey.toBase58(),
            };
        });
    },
    getAccountKeySigningData: () => {
        return apiSdk.getAccountKeySigningData();
    },
    getSigningKeySigningData: () => {
        return apiSdk.getSigningKeySigningData();
    },
    getAliasByAccountPublicKey: async (
        accountPk: string,
        accountPrivateKey: string
    ) => {
        log("getAliasByAccountPublicKey: " + accountPk);
        return await tryFunc(async () => {
            const { PrivateKey } = await import("snarkyjs");
            const priKey = PrivateKey.fromBase58(accountPrivateKey);
            return await apiSdk.getAliasByAccountPublicKey(accountPk, priKey);
        });
    },

    updateAliasForUserState: async (accountPk: string, alias: string) => {
        await tryFunc(async () => {
            await apiSdk.updateAliasForUserState(accountPk, alias);
        });
    },

    isAliasRegistered: async (alias: string, includePending: boolean) => {
        return await tryFunc(async () => {
            return await apiSdk.isAliasRegistered(alias, includePending);
        });
    },

    sendTx: async (tx: Tx) => {
        await tryFunc(async () => {
            await apiSdk.sendTx(tx);
        });
    },
    getKeypair: async (privateKey58: string) => {
        const { PrivateKey } = await import("snarkyjs");
        const privateKey = PrivateKey.fromBase58(privateKey58);
        const publicKey = privateKey.toPublicKey();
        return {
            privateKey: privateKey58,
            publicKey: publicKey.toBase58(),
        };
    },
    getLocalAccounts: async () => {
        return await apiSdk.getAccounts();
    },
    getSercetKey: async (accountPk58: string, pwd: string) => {
        const { PublicKey } = await import("snarkyjs");
        const sk = await apiSdk.getSecretKey(
            PublicKey.fromBase58(accountPk58),
            pwd
        );
        if (sk) {
            return sk.toBase58();
        }

        return undefined;
    },
    getSigningKeys: async (accountPk: string) => {
        return await apiSdk.getSigningKeys(accountPk);
    },
    getClaimableNotes: async (l1address: string, commitments: string[]) => {
        return await apiSdk.getClaimableNotes(l1address, commitments);
    },
    getL1Account: async (l1address: string, tokenId?: string) => {
        const ac = await apiSdk.getL1Account(l1address, tokenId);
        return JSON.parse(JSON.stringify(ac));
    },
    checkTx: async (
        txId: string,
        options?: { maxAttempts?: number; interval?: number }
    ) => {
        const { Mina, checkZkappTransaction } = await import("snarkyjs");
        let Blockchain = Mina.Network(minaEndpoint);
        Mina.setActiveInstance(Blockchain);
        let maxAttempts = options?.maxAttempts ?? 500;
        let interval = options?.interval ?? 20000;
        let attempts = 0;
        const executePoll = async (
            resolve: () => void,
            reject: (err: Error) => void | Error
        ) => {
            let res;
            try {
                res = await checkZkappTransaction(txId);
            } catch (error) {
                return reject(error as Error);
            }
            attempts++;
            if (res.success) {
                return resolve();
            } else if (res.failureReason) {
                return reject(
                    new Error(
                        `Transaction failed.\nTransactionId: ${txId}\nAttempts: ${attempts}\nfailureReason(s): ${res.failureReason}`
                    )
                );
            } else if (maxAttempts && attempts === maxAttempts) {
                return reject(
                    new Error(
                        `Exceeded max attempts.\nTransactionId: ${txId}\nAttempts: ${attempts}\nLast received status: ${res}`
                    )
                );
            } else {
                setTimeout(executePoll, interval, resolve, reject);
            }
        };

        // @ts-ignore
        return new Promise(executePoll);
    },
    getAccountPublicKeyByAlias: async (alias: string) => {
        const pubKey = await apiSdk.getAccountPublicKeyByAlias(alias);
        if (pubKey) {
            return pubKey.toBase58();
        }

        return undefined;
    },
    getBalance: async (accountPk: string) => {
        return await apiSdk.getBalance(accountPk);
    },
    getTxFees: async () => {
        return await apiSdk.getTxFees();
    },
};

//onconnect = (e: any) => expose(sdkWrapper, e.ports[0]);

expose(apiWrapper);

export type ApiWrapper = typeof apiWrapper;