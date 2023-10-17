<template>
    <div style="justify-content: flex-start; align-items: flex-start;">
        <div class="header" @click="toBack">
            <van-icon name="arrow-left" size="24" />
        </div>
        <div class="page-login">
            <!-- <div class="logo">
                    <img :src="loginImage" class="arrow" alt="" />
                </div> -->

            <div class="login-title">
                Login Ano.Cash
            </div>

            <div class="keys-login">
                <n-alert type="info" style="width:100%; margin-bottom: 35px;">
                    The keys you enter will be encrypted with your password and stored locally in the browser, and will
                    not be sent to the AnoCash server.
                </n-alert>

                <n-space vertical :size="28" style="width: 100%;">
                    <div class="form-item">
                        <div v-show="showAccountPrivateKeyTitle" class="placeholder">{{ placeholderAccountPrivateKey }}
                        </div>
                        <n-input v-model:value="accountPrivateKey" clearable class="item" type="text" size="large"
                            :placeholder="placeholderAccountPrivateKey" @blur="blurAccountPrivateKey"
                            @input="inputAccountPrivateKey" />
                    </div>

                    <div class="form-item">
                        <div v-show="showAccountSigningKeyTitle" class="placeholder">{{ placeholderAccountSigningKey }}
                        </div>
                        <n-input v-model:value="accountSigningKey" clearable class="item" type="text" size="large"
                            :placeholder="placeholderAccountSigningKey" @blur="blurAccountSigningKey"
                            @input="inputAccountSigningKey" />
                    </div>

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
                            show-password-on="mousedown" :placeholder="placeholderPwdAgain" :maxlength="30"
                            @blur="blurPwdAgain" @input="inputPwdAgain" />
                    </div>
                </n-space>

                <n-button type="info" class="form-btn" @click="generateAccountKeys">
                    Generate Account Keys
                </n-button>

                <n-button type="info" class="form-btn" style="margin-bottom: 20px;" @click="login">
                    Login
                </n-button>
            </div>




        </div>
    </div>
</template>

<script lang="ts" setup>
import { useMessage } from "naive-ui";
import { ref } from "vue";
import { AccountStatus } from "../../common/constants";

const message = useMessage();
const { SdkState, addAccount } = useSdk();
const remoteApi = SdkState.remoteApi!;
const { setAlias, setAccountStatus, appState, setAccountPk58, showLoadingMask, closeLoadingMask, setSigningPk1_58, setSigningPk2_58 } = useStatus();
const router = useRouter();

const toBack = () => router.back();

const toRegisterAliasPage = async () => {
    await navigateTo("/connect/step-2");
};

const toAccountPage = async () => {
    await navigateTo("/account", { replace: true });
};

const accountPrivateKey = ref("");
const placeholderAccountPrivateKey = ref("Account Private Key");
const showAccountPrivateKeyTitle = ref(false);
const blurAccountPrivateKey = () => {
    if (accountPrivateKey.value.length === 0) {
        showAccountPrivateKeyTitle.value = false;
    }
};
const inputAccountPrivateKey = () => {
    if (!showAccountPrivateKeyTitle.value) {
        showAccountPrivateKeyTitle.value = true;
    }
};

const accountSigningKey = ref("");
const placeholderAccountSigningKey = ref("Account Signing Key");
const showAccountSigningKeyTitle = ref(false);
const blurAccountSigningKey = () => {
    if (accountSigningKey.value.length === 0) {
        showAccountSigningKeyTitle.value = false;
    }
};
const inputAccountSigningKey = () => {
    if (!showAccountSigningKeyTitle.value) {
        showAccountSigningKeyTitle.value = true;
    }
};

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

const maskId = "login-index";

const generateAccountKeys = async () => {
    try {
        const accountKeys = await remoteApi.getRandomKeypair();
        const signingKeys = await remoteApi.getRandomKeypair();
        accountPrivateKey.value = accountKeys.privateKey;
        accountSigningKey.value = signingKeys.privateKey;
        showAccountPrivateKeyTitle.value = true;
        showAccountSigningKeyTitle.value = true;
    } catch (err: any) {
        console.error(err);
        message.error(err.message);
    }
};

const login = async () => {
    const accountPrivateKeyTrim = accountPrivateKey.value.trim();
    if (accountPrivateKeyTrim.length === 0) {
        message.error("Account Private Key is required");
        return;
    }
    const accountSigningKeyTrim = accountSigningKey.value.trim();
    if (accountSigningKeyTrim.length === 0) {
        message.error("Account Signing Key is required");
        return;
    }
    const pwdTrim = pwd.value.trim();
    if (pwdTrim.length === 0) {
        message.error("Password is required");
        return;
    }
    const pwdAgainTrim = pwdAgain.value.trim();
    if (pwdAgainTrim.length === 0) {
        message.error("Password Again is required");
        return;
    }
    if (pwdTrim !== pwdAgainTrim) {
        message.error("Password and Password Again must be the same");
        return;
    }

    try {
        showLoadingMask({ id: maskId, text: "Login...", closable: false });
        // check account is registered
        const accountPk58 = (await remoteApi.getKeypair(accountPrivateKeyTrim)).publicKey;
        const signingPk1_58 = (await remoteApi.getKeypair(accountSigningKeyTrim)).publicKey;
        const signingKeypair2 = await remoteApi.getRandomKeypair();

        // get alias
        let alias = await remoteApi.getAliasByAccountPublicKey(accountPk58, accountPrivateKeyTrim);

        const accountPk = await addAccount(accountPrivateKeyTrim, pwdTrim, accountSigningKeyTrim,
            signingKeypair2.privateKey, alias);
        if (accountPk) {
            if (alias) {
                setAlias(alias);
                setAccountStatus(AccountStatus.REGISTERED);
            } else {
                console.log('alias not found, should go to register flow');
                setAccountStatus(AccountStatus.UNREGISTERED);
            }

            setAccountPk58(accountPk58);
            setSigningPk1_58(signingPk1_58);
            setSigningPk2_58(signingKeypair2.publicKey);
            message.success('Account saved successfully');

            if (appState.value.accountStatus !== AccountStatus.UNREGISTERED) {
                await toAccountPage();
            } else {
                await toRegisterAliasPage();
            }

            closeLoadingMask(maskId);
        }
    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, {
            closable: true,
            duration: 3000,
        });
    }

};

</script>
<style lang="scss" scoped>
.page-login {
    // .logo {
    //     display: block;
    //     margin-top: 60px;
    //     width: 100%;
    //     height: 160px;

    //     img {
    //         height: 100%;
    //     }
    // }
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    width: 100%;

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

    .form-btn {
        margin-top: 40px;
        width: 100%;
        height: 52px;
        border-radius: 12px;
    }


    .login-title {
        // margin-top: 28px;
        font-size: 30px;
        font-weight: 500;
        line-height: 46px;
        width: 100%;

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .keys-login {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: flex-start;
        margin-top: 20px;
        width: 100%;
    }


}
</style>
