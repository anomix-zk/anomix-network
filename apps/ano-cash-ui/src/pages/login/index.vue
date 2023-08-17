<template>
    <div class="up-app">
        <div class="page" style="justify-content: flex-start; align-items: flex-start;">
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
                            <n-input v-model:value="accountPrivateKey" class="item" type="text" size="large"
                                :placeholder="placeholderAccountPrivateKey" @blur="blurAccountPrivateKey"
                                @input="inputAccountPrivateKey" />
                        </div>

                        <div class="form-item">
                            <div v-show="showAccountSigningKeyTitle" class="placeholder">{{ placeholderAccountSigningKey }}
                            </div>
                            <n-input v-model:value="accountSigningKey" class="item" type="text" size="large"
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

                    <n-button type="info" class="form-btn" style="margin-bottom: 20px;">
                        Login
                    </n-button>
                </div>




            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import loginImage from "@/assets/analysis.svg";
import { ref } from "vue";
const router = useRouter();
const privateKey = ref("");

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




const existAccount = ref(true);
const selectedAccount = ref('');
const options = [
    {
        label: "Vitalik(0xb284...65e4)",
        value: 'song0'
    },
    {
        label: "0xb299...37e9",
        value: 'song1'
    },
];

function formSubmit(values: any) {
    console.log(privateKey.value);
    router.push("/connect?step=2");
}
const toBack = () => history.back();
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
            background-color: var(--up-bg-checked);
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
            //background-color: var(--up-background);
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
