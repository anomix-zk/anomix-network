<template>
    <div class="step-content">
        <!-- <div class="step-logo" @click="formSubmit">
            <img :src="step1" alt="" />
        </div> -->

        <div class="h1">Enter AnoCash</div>
        <div class="h2" style="margin-bottom: 40px;">Your first private account for Mina</div>


        <div class="label">Extern Wallet Address</div>
        <div class="item">
            <div style="display: flex; align-items: center;">
                <img :src="auroLogo" alt="" style="width: 25px; height: 25px;" />
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ externWalletAddress }}</span>
            </div>

            <van-icon name="cross" size="20" @click="disconnect" />
        </div>

        <div v-if="accountPubKey !== null">
            <div class="label">Anomix Account</div>
            <div class="item" @click="copyContent(appState.accountPk58!)">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ accountPubKey }}</span>
            </div>
        </div>

        <div v-if="appState.alias !== null">
            <div class="label">Registered Alias</div>
            <div class="item" @click="copyContent(appState.alias)">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ appState.alias }}</span>
            </div>
        </div>

        <div v-if="signingPubKey1 !== null">
            <div class="label">Signing PublicKey 1</div>
            <div class="item" @click="copyContent(signingKeypair1!.publicKey)">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ signingPubKey1 }}</span>
            </div>
        </div>

        <div v-if="signingPubKey2 !== null">
            <div class="label">Signing PublicKey 2</div>
            <div class="item" @click="copyContent(signingKeypair2!.publicKey)">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ signingPubKey2 }}</span>
            </div>
        </div>

        <template v-if="accountPubKey === null">
            <n-alert type="info" style="width:100%;" class="tips">
                Clicking the button below will trigger the auro wallet extension to perform signature
                authorization and export your Anomix account, please feel free to operate.
            </n-alert>

            <n-button type="info" class="form-btn" @click="deriveAccountPubKey">
                Retrieve Anomix Account
            </n-button>
        </template>


        <template v-if="signingKeypair1 === null && signingKeypair2 === null && accountPubKey !== null">
            <n-alert type="info" style="width:100%;" class="tips">
                Next Step: Clicking the button below will trigger the auro wallet extension to perform signature
                authorization and export your signing keys for anomix account, please feel free to operate.
            </n-alert>

            <n-button type="info" class="form-btn" @click="deriveSigningKeys">
                Retrieve Signing Keys
            </n-button>
        </template>

        <template v-if="signingKeypair1 !== null && signingKeypair2 !== null">
            <n-alert type="info" style="width:100%;" class="tips">
                Next Step: Set a password to encrypt and save the keys related to your Anomix account to the current browser
                locally, so that you can use the password to log in next time, and only you can access these keys, which
                will not be uploaded to the server.
            </n-alert>
            <n-space vertical :size="28" style="width: 100%; margin-top: 30px;">
                <div class="form-item">
                    <div v-show="showPwdTitle" class="placeholder">{{ placeholderPwd }}
                    </div>
                    <n-input v-model:value="pwd" class=" item" clearable type="password" size="large"
                        show-password-on="mousedown" :placeholder="placeholderPwd" :maxlength="30" @blur="blurPwd"
                        @input="inputPwd" />
                </div>

                <div class="form-item">
                    <div v-show="showPwdAgainTitle" class="placeholder">{{ placeholderPwdAgain }}
                    </div>
                    <n-input v-model:value="pwdAgain" class=" item" clearable type="password" size="large"
                        show-password-on="mousedown" :placeholder="placeholderPwdAgain" :maxlength="30" @blur="blurPwdAgain"
                        @input="inputPwdAgain" />
                </div>

            </n-space>

            <n-button type="info" class="form-btn" style="margin-bottom: 20px;" @click="addAnomixAccount">
                Save Account
            </n-button>
        </template>

    </div>
</template>

<script lang="ts" setup>
import auroLogo from "@/assets/auro.png";
import { useMessage } from "naive-ui";
import { AccountStatus } from "../../../common/constants";

const emit = defineEmits<{
    (e: 'nextStep', step: number): void;
}>();
const { appState, setConnectedWallet, setAccountPk58, setAlias, setAccountStatus, setSigningPk1_58, setSigningPk2_58, showLoadingMask, closeLoadingMask } = useStatus();
const { omitAddress } = useUtils();
const { SdkState, addAccount } = useSdk();
const message = useMessage();
const remoteApi = SdkState.remoteApi!;

const externWalletAddress = computed(() => omitAddress(appState.value.connectedWallet58, 8));
const accountPubKey = computed(() => omitAddress(appState.value.accountPk58, 8));
const accountPrivateKey = ref('');
const signingKeypair1 = ref<{ privateKey: string; publicKey: string } | null>(null);
const signingPubKey1 = computed(() => omitAddress(signingKeypair1.value?.publicKey, 8));
const signingKeypair2 = ref<{ privateKey: string; publicKey: string } | null>(null);
const signingPubKey2 = computed(() => omitAddress(signingKeypair2.value?.publicKey, 8));
const maskId = "step1";

const pwd = ref("");
const placeholderPwd = ref("Password");
const showPwdTitle = ref(false);
const blurPwd = () => {
    if (pwd.value.length === 0) {
        showPwdTitle.value = false;
    }
};
const inputPwd = () => {
    if (!showPwdTitle.value) {
        showPwdTitle.value = true;
    }
};


const pwdAgain = ref("");
const placeholderPwdAgain = ref("Password Again");
const showPwdAgainTitle = ref(false);
const blurPwdAgain = () => {
    if (pwdAgain.value.length === 0) {
        showPwdAgainTitle.value = false;
    }
};
const inputPwdAgain = () => {
    if (!showPwdAgainTitle.value) {
        showPwdAgainTitle.value = true;
    }
};

const disconnect = async () => {
    setConnectedWallet(null);
    setAccountPk58(null);
    setAlias(null);
    accountPrivateKey.value = '';
    signingKeypair1.value = null;
    signingKeypair2.value = null;
    setAccountStatus(AccountStatus.UNREGISTERED);
    await navigateTo("/", { replace: true });
};

const walletListenerSetted = ref(false);
let copyFunc: (text: string) => void;

const route = useRoute();
onMounted(() => {
    console.log('Step1 onMounted...');
    console.log('current path: ', route.path);
    const { copyText } = useClientUtils();
    copyFunc = copyText;

    if (!walletListenerSetted.value) {
        if (window.mina) {
            window.mina.on('accountsChanged', async (accounts: string[]) => {
                console.log('step1.vue - connected account change: ', accounts);
                if (route.path === '/connect/step-1') {
                    if (accounts.length === 0) {
                        message.error('Please connect your wallet', {
                            closable: true,
                            duration: 0
                        });

                        await disconnect();
                    } else {
                        setConnectedWallet(accounts[0]);
                    }
                }
            });

            window.mina.on('chainChanged', (chainType: string) => {
                console.log('step1.vue - current chain: ', chainType);
                if (chainType !== appState.value.minaNetwork) {
                    message.error('Please switch to Berkeley network', {
                        closable: true,
                        duration: 0
                    });
                }
            });

            walletListenerSetted.value = true;
        }
    }
});

const copyContent = (content: string) => {
    copyFunc(content);
    message.success("Copy successfully");
};

const toRegisterAliasPage = () => {
    emit('nextStep', 2);
};

const toAccountPage = async () => {
    //router.replace("/account");
    await navigateTo("/account", { replace: true });
};

const addAnomixAccount = async () => {
    if (pwd.value.length === 0) {
        message.error('Please enter a password');
        return;
    }
    if (pwdAgain.value.length === 0) {
        message.error('Please enter a password again');
        return;
    }
    if (pwd.value !== pwdAgain.value) {
        message.error('The two passwords are inconsistent');
        return;
    }

    try {
        showLoadingMask({ id: maskId, text: 'Saving account locally...', closable: false });
        const accountPk = await addAccount(accountPrivateKey.value, pwd.value, signingKeypair1.value?.privateKey, signingKeypair2.value?.privateKey, appState.value.alias === null ? undefined : appState.value.alias);
        if (accountPk) {
            setAccountPk58(accountPk);
            message.success('Account saved successfully');

            if (appState.value.accountStatus !== AccountStatus.UNREGISTERED) {
                await toAccountPage();
            } else {
                setSigningPk1_58(signingKeypair1.value?.publicKey);
                setSigningPk2_58(signingKeypair2.value?.publicKey);
                toRegisterAliasPage();
            }

            closeLoadingMask(maskId);
        }
    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, {
            closable: true,
            duration: 0
        });

    }

}

const deriveSigningKeys = async () => {
    if (!window.mina) {
        message.error('Please install Auro wallet extension first');
        return;
    }

    showLoadingMask({ id: maskId, text: 'Deriving signing keys...', closable: true });
    let signMessage = await remoteApi.getSigningKeySigningData();
    try {
        let signResult = await window.mina.signMessage({
            message: signMessage,
        })
        console.log('sign result: ', signResult);
        let sk1 = await remoteApi.generateKeyPair(signResult.signature, 0);
        signingKeypair1.value = sk1;
        let sk2 = await remoteApi.generateKeyPair(signResult.signature, 1);
        signingKeypair2.value = sk2;
        closeLoadingMask(maskId);
    } catch (error: any) {
        console.error('deriveSigningKeys: ', error);
        message.error(error.message, {
            closable: true,
            duration: 0
        });
        closeLoadingMask(maskId);
    }

};

const deriveAccountPubKey = async () => {
    if (!window.mina) {
        message.error('Please install Auro wallet extension first');
        return;
    }

    showLoadingMask({ id: maskId, text: 'Deriving anomix account...', closable: true });
    let signMessage = await remoteApi.getAccountKeySigningData();
    try {
        let signResult = await window.mina.signMessage({
            message: signMessage,
        })
        console.log('sign result: ', signResult);
        let accountKeypair = await remoteApi.generateKeyPair(signResult.signature);
        setAccountPk58(accountKeypair.publicKey);
        accountPrivateKey.value = accountKeypair.privateKey;

        showLoadingMask({ id: maskId, text: 'Checking if alias is registered...', closable: false });
        // get alias
        let alias = await remoteApi.getAliasByAccountPublicKey(accountKeypair.publicKey, accountKeypair.privateKey);
        if (alias) {
            setAlias(alias);
            setAccountStatus(AccountStatus.REGISTERED);
        } else {
            console.log('alias not found, go to register flow');
            setAccountStatus(AccountStatus.UNREGISTERED);
        }
        closeLoadingMask(maskId);
    } catch (error: any) {
        console.error('deriveAccountPubKey: ', error);
        message.error(error.message, {
            closable: true,
            duration: 0
        });
        closeLoadingMask(maskId);
    }

};

</script>
<style lang="scss" scoped>
.step-content {
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    width: 100%;
    text-align: center;

    .form-item {
        position: relative;

        .item {
            background-color: var(--ano-bg-checked);
        }

        .placeholder {
            position: absolute;
            left: 16px;
            top: -8px;
            height: 16px;
            font-size: 16px;
            font-weight: 400;
            line-height: 16px;
            color: #606266;
            z-index: 999;
            //background-color: var(--ano-background);
        }

    }

    .tips {
        margin-top: 40px;
    }

    .form-btn {
        margin-top: 20px;
        width: 100%;
        height: 52px;
        border-radius: 12px;
    }

    .item {
        cursor: pointer;
        width: 100%;
        display: flex;
        justify-content: space-between;
        color: #000;
        border-radius: 12px;
        height: 56px;
        line-height: 56px;
        border-width: 1px;
        background-color: #f7f7f7;
        padding: 0 15px;
        font-size: 16px;
        align-items: center;
    }

    .label {
        font-size: 16px;
        padding-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 540;
        line-height: 26px;
        margin-top: 15px;
    }


    .h1 {
        font-size: 30px;
        font-weight: 500;
        line-height: 46px;
    }

    .h2 {
        margin-top: 4px;
        font-size: 16px;
        line-height: 20px;
        font-weight: 600;
    }
}
</style>
