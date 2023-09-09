import type { AnomixSdk, SdkConfig } from "@anomix/sdk";
import { expose } from "comlink";
import { log, tryFunc } from "../utils";

let sdk: AnomixSdk;
//const logLabel = "sdk_worker";
// const chan = new BroadcastChannel(CHANNEL_LOG);

// Use circuit realted methods from the SDK
const sdkWrapper = {
    createSdk: async (config: SdkConfig) => {
        log("create sdk...");
        const { createAnomixSdk } = await import("@anomix/sdk");
        log("sdk loaded");

        await tryFunc(async () => {
            sdk = await createAnomixSdk(config);
        });
        log("sdk created");
    },

    isPrivateCircuitCompiled: () => {
        return sdk.privateCircuitCompiled();
    },

    isEntryContractCompiled: () => {
        return sdk.entryContractCompiled();
    },

    isVaultContractCompiled: () => {
        return sdk.vaultContractCompiled();
    },

    createAccountRegisterTx: async (
        accountPk58: string,
        alias: string,
        newSigningPk1_58: string,
        newSigningPk2_58: string
    ) => {
        log("createAccountRegisterTx...");
        const { PublicKey } = await import("snarkyjs");

        return await tryFunc(async () => {
            const accountPk = PublicKey.fromBase58(accountPk58);
            const newSigningPk1 = PublicKey.fromBase58(newSigningPk1_58);
            const newSigningPk2 = PublicKey.fromBase58(newSigningPk2_58);
            return await sdk.createAccountRegisterTx({
                accountPk,
                alias,
                newSigningPk1,
                newSigningPk2,
            });
        });
    },

    unlockKeyStore: async (cachedPubKeys: string[], pwd: string) => {
        await sdk.unlockKeyStore(cachedPubKeys, pwd);
    },

    getWithdrawAccountTokenId: async () => {
        const { TokenId } = await import("snarkyjs");
        let tokenIdField = sdk.getWithdrawAccountTokenId();

        return TokenId.toBase58(tokenIdField);
    },
    createWithdrawalAccount: async (
        userPk: string,
        feePayerPk: string,
        txFee?: string
    ) => {
        const { PublicKey, UInt64 } = await import("snarkyjs");
        const feePayerAddress = PublicKey.fromBase58(feePayerPk);
        const userAddress = PublicKey.fromBase58(userPk);
        const suggestedTxFee = txFee ? UInt64.from(txFee) : undefined;
        return await sdk.createDeployWithdrawAccountTx({
            userAddress,
            feePayerAddress,
            suggestedTxFee,
        });
    },
    createClaimFundsTx: async (
        withdrawNoteCommitment: string,
        feePayer: string,
        txFee?: string
    ) => {
        const { PublicKey, UInt64 } = await import("snarkyjs");
        const feePayerAddress = PublicKey.fromBase58(feePayer);
        const suggestedTxFee = txFee ? UInt64.from(txFee) : undefined;
        return await sdk.createClaimFundsTx({
            withdrawNoteCommitment,
            feePayerAddress,
            suggestedTxFee,
        });
    },
    createDepositTx: async ({
        payerAddress,
        receiverAddress,
        feePayerAddress,
        suggestedTxFee,
        amount,
        anonymousToReceiver,
    }: {
        payerAddress: string;
        receiverAddress: string;
        feePayerAddress: string;
        suggestedTxFee?: string;
        amount: string;
        anonymousToReceiver: boolean;
    }) => {
        const { PublicKey, PrivateKey, UInt64, Field } = await import(
            "snarkyjs"
        );

        return await sdk.createDepositTx({
            payerAddress: PublicKey.fromBase58(payerAddress),
            receiverAddress: PublicKey.fromBase58(receiverAddress),
            feePayerAddress: PublicKey.fromBase58(feePayerAddress),
            suggestedTxFee: suggestedTxFee
                ? UInt64.from(suggestedTxFee)
                : undefined,
            amount: UInt64.from(amount),
            anonymousToReceiver,
            assetId: Field(1), // MINA
            receiverAccountRequired: Field(2), // NOT REQUIRED
            noteEncryptPrivateKey: PrivateKey.random(),
        });
    },
};

//onconnect = (e: any) => expose(sdkWrapper, e.ports[0]);

expose(sdkWrapper);

export type SdkWrapper = typeof sdkWrapper;
