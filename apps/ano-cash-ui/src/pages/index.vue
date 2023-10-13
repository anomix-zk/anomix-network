<template>
    <div class="header">Ano.Cash</div>
    <div class="login">
        <div class="logo">
            <img :src="loginImage" alt="Ano.Cash" />
        </div>
        <h1 class="title">Login AnoCash</h1>
        <!---->
        <div class="oauth-box">
            <div class="auth-item">
                <n-button color="#f4f4f4" :bordered="false" block type="primary" class="auth-btn"
                    @click="connectWallet('connect')">
                    <div style="display:flex; align-items: center;">
                        <img :src="auroLogo" alt="" style="width: 30px; height: 30px;" />
                        <span style="color:#1f202a">Connect Wallet</span>
                    </div>
                </n-button>
            </div>
            <div class="auth-item">
                <n-button color="#f4f4f4" :bordered="false" block type="primary" @click="login" class="auth-btn">
                    <div style="display:flex; align-items: center;">
                        <img :src="keyImage" alt="" style="width: 36px; height: 36px;" />
                        <span style="color:#1f202a">Login With Key</span>
                    </div>
                </n-button>
            </div>

            <div v-if="existLocalAccount" class="auth-item">
                <n-button color="#f4f4f4" :bordered="false" block type="primary" @click="sessionLogin" class="auth-btn">
                    <div style="display:flex; align-items: center;">
                        <span style="color:#1f202a">Login With Local Account</span>
                    </div>
                </n-button>
            </div>
        </div>

        <div class="or-box">
            <div class="line"></div>
            <span>OR CLAIM WITHDRAWABLE ASSETS</span>
            <div class="line"></div>
        </div>

        <div class="oauth-box" style="margin-top: 30px;">
            <div class="auth-item">
                <n-button color="#f4f4f4" :bordered="false" block type="primary" @click="connectWallet('claim')"
                    class="auth-btn">
                    <div style="display:flex; align-items: center;">
                        <img :src="claimImage" alt="" style="width: 35px; height: 35px;" />
                        <span style="color:#1f202a">Claim Assets</span>
                    </div>
                </n-button>
            </div>
        </div>

    </div>

    <div class="footer">© Powered By Anomix</div>
</template>

<script lang="ts" setup>
import loginImage from "@/assets/anomix.svg";
import auroLogo from "@/assets/auro.png";
import keyImage from "@/assets/key.png";
import claimImage from "@/assets/claim.svg";
import { h } from "vue";
import { useMessage, useNotification } from "naive-ui";

const notification = useNotification();
const message = useMessage();
const { appState, setConnectedWallet, showLoadingMask, closeLoadingMask } = useStatus();
const { SdkState } = useSdk();

const maskId = "index";
const existLocalAccount = ref(false);
const showTestReminder = ref(false);

onMounted(async () => {
    console.log('App index onMounted...');
    try {
        if (!showTestReminder.value) {
            notification.info({
                title: () => h('div', {
                    innerHTML: `<div style="color: red;font-weight:600;">AnoCash Test Reminder</div>`,
                }),
                content: () => h('div', {
                    innerHTML: `<div style="font-weight:600;">This is a very early MVP test version of AnoCash, do not use your Mainnet wallet keys or funds for testing!!<br/><br/>After you install Auro wallet extension, switch to the "Berkeley" network:<br/><a href='https://www.aurowallet.com/' target='_blank'>Install Auro Wallet ></a><br/><br/>Claim test funds (Berkeley) for your auro wallet address:<br/><a href='https://faucet.minaprotocol.com/' target='_blank'>Testnet Faucet ></a></div>`
                }),
            });
            showTestReminder.value = true;
        }

        if (SdkState.remoteApi !== null) {
            const accounts = await SdkState.remoteApi.getLocalAccounts();
            if (accounts.length > 0) {
                existLocalAccount.value = true;
            }
        }

    } catch (err: any) {
        console.error(err);
    }

});

const sessionLogin = async () => {
    await navigateTo("/login/session");
};

const login = async () => {
    await navigateTo("/login");
}

const connectWallet = async (action: string) => {
    if (!window.mina) {
        message.error('Please install auro wallet browser extension first.');
        return;
    }

    try {
        showLoadingMask({ id: maskId, text: 'Connecting wallet...', closable: false });
        const currentNetwork = await window.mina.requestNetwork();
        console.log({ currentNetwork });
        if (appState.value.minaNetwork !== currentNetwork && currentNetwork !== 'Unknown') {
            closeLoadingMask(maskId);
            message.error(`Please switch to the correct network (${appState.value.minaNetwork}) first.`);
            return;
        }

        let accounts = await window.mina.requestAccounts();
        setConnectedWallet(accounts[0]);

        if (action === 'connect') {

            await navigateTo("/connect/step-1");
        } else {
            await navigateTo("/claim/claimable");
        }
        closeLoadingMask(maskId);
    } catch (error: any) {
        // if user reject, requestAccounts will throw an error with code and message filed
        console.log(error.message, error.code);
        message.error(error.message);
        closeLoadingMask(maskId);
    }
    //showLoadingMask({ text: 'Account registration service is not ready yet', closable: false });
};

</script>
<style lang="scss" scoped>
.login {
    //text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 40px;
        width: 100%;
        height: 140px;

        img {
            height: 100%;
        }
    }

    h1 {
        margin-top: 24px;
        font-weight: 700;
        font-size: 24px;
        line-height: 36px;
    }

    .title {
        display: inline-block;
        position: relative;
        width: 180px;
        white-space: nowrap;
        animation: typing 2.5s ease-in;
        overflow: hidden;
        color: #000;

        margin-bottom: 30px;
    }

    /* 打印效果 */
    @keyframes typing {
        from {
            width: 0;
        }

        to {
            width: 180px;
        }
    }

    .oauth-box {
        margin-top: 20px;
        width: 100%;

        .auth-item {
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 60px;
            border-radius: 12px;

            background-color: var(--ano-bg-checked);
            transition: all .15s;
            box-shadow: inset 1px 1px 3px var(--ano-line);

            span {
                margin-left: 10px;
                font-weight: 600;
                font-size: 16px;
                line-height: 24px;
            }

            .auth-btn {
                display: flex;
                flex-wrap: nowrap;
                justify-content: center;
                align-items: center;
                align-content: center;
                height: 100%;
                border-radius: 12px;
            }
        }

        .auth-item+.auth-item {
            margin-top: 20px;
        }
    }

    .or-box {
        margin-top: 40px;
        display: flex;
        justify-content: center;
        align-items: center;

        .line {
            width: 60px;
            height: 1px;
            background-color: var(--ano-text-third);
        }

        span {
            margin: 0 10px;
            font-size: 12px;
            font-weight: 400;
        }
    }

}

.footer {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    //height: 20px;
    line-height: 50px;
    text-align: center;
    color: gray;
    font-size: 16px;
    font-weight: 400;
}
</style>
