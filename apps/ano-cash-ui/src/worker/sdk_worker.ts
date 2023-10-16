import type { AnomixSdk, SdkConfig } from "@anomix/sdk";
import { expose } from "comlink";
import { log } from "../utils";

let sdk: AnomixSdk;
//const logLabel = "sdk_worker";
// const chan = new BroadcastChannel(CHANNEL_LOG);

// Use circuit realted methods from the SDK
const sdkWrapper = {
    createSdk: async (config: SdkConfig) => {
        log("create sdk...");
        const { createAnomixSdk } = await import("@anomix/sdk");
        log("sdk loaded");

        sdk = await createAnomixSdk(config);

        log("sdk created");
    },

    compileVaultContract: async () => {
        await sdk.compileVaultContract();
    },

    compileEntryContract: async () => {
        await sdk.compileEntryContract();
    },

    compilePrivateCircuit: async () => {
        await sdk.compilePrivateCircuit();
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
        newSigningPk2_58: string,
    ) => {
        log("createAccountRegisterTx...");
        const { PublicKey } = await import("o1js");

        const accountPk = PublicKey.fromBase58(accountPk58);
        const newSigningPk1 = PublicKey.fromBase58(newSigningPk1_58);
        const newSigningPk2 = PublicKey.fromBase58(newSigningPk2_58);
        return await sdk.createAccountRegisterTx({
            accountPk,
            alias,
            newSigningPk1,
            newSigningPk2,
        });
    },

    unlockKeyStore: async (cachedPubKeys: string[], pwd: string) => {
        await sdk.unlockKeyStore(cachedPubKeys, pwd);
    },

    lockKeyStore: () => {
        sdk.lockKeyStore();
    },

    getWithdrawAccountTokenId: async () => {
        const { TokenId } = await import("o1js");
        let tokenIdField = sdk.getWithdrawAccountTokenId();

        return TokenId.toBase58(tokenIdField);
    },
    createWithdrawalAccount: async (
        userPk: string,
        feePayerPk: string,
        txFee?: string,
    ) => {
        const { PublicKey, UInt64 } = await import("o1js");
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
        txFee?: string,
    ) => {
        const { PublicKey, UInt64 } = await import("o1js");
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
        const { PublicKey, PrivateKey, UInt64, Field } = await import("o1js");

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

    createPaymentTx: async ({
        accountPk58,
        alias,
        senderAccountRequiredBool,
        receiverPk58,
        receiverAccountRequiredBool,
        anonToReceiver,
        amount,
        txFeeAmount,
        isWithdraw,
    }: {
        accountPk58: string;
        alias: string | null;
        senderAccountRequiredBool: boolean;
        receiverPk58: string;
        receiverAccountRequiredBool: boolean;
        anonToReceiver: boolean;
        amount: string;
        txFeeAmount: string;
        isWithdraw: boolean;
    }) => {
        const { PublicKey, Field, UInt64 } = await import("o1js");
        const accountPk = PublicKey.fromBase58(accountPk58);
        const senderAccountRequired = senderAccountRequiredBool
            ? Field(1)
            : Field(2);
        const receiver = PublicKey.fromBase58(receiverPk58);
        const receiverAccountRequired = receiverAccountRequiredBool
            ? Field(1)
            : Field(2);
        const anonymousToReceiver = anonToReceiver;
        const payAmount = UInt64.from(amount);
        const payAssetId = Field(1);
        const txFee = UInt64.from(txFeeAmount);

        return await sdk.createPaymentTx({
            accountPk,
            alias,
            senderAccountRequired,
            receiver,
            receiverAccountRequired,
            anonymousToReceiver,
            payAmount,
            payAssetId,
            txFee,
            isWithdraw,
        });
    },
};

//onconnect = (e: any) => expose(sdkWrapper, e.ports[0]);

expose(sdkWrapper);

export type SdkWrapper = typeof sdkWrapper;
