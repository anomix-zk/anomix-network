<template>
    <div style="justify-content: flex-start; align-items: flex-start;">

        <div class="page-login">

            <div class="logo">
                <img :src="loginImage" alt="Ano.Cash" />
            </div>
            <div class="login-title">
                Login Ano.Cash
            </div>


            <div class="session-login">

                <n-space vertical :size="30" style="width: 100%;">
                    <div class="form-item">
                        <div class="item-label">Anomix Account</div>

                        <n-select class="item" style="--n-height:56px !important;" v-model:value="selectedAccount"
                            :options="options" @update:value="handleUpdateValue" />

                    </div>

                    <div class="form-item" style="margin-top: 10px;">
                        <div v-show="showPwdTitle" class="placeholder">{{ placeholderPwd }}
                        </div>
                        <n-input v-model:value="pwd" class="item" clearable type="password" show-password-on="click"
                            size="large" :placeholder="placeholderPwd" :maxlength="30" @blur="blurPwd" @input="inputPwd" />
                    </div>
                </n-space>

                <n-button type="info" class="form-btn" @click="login">
                    Login
                </n-button>
            </div>



        </div>
    </div>
</template>

<script lang="ts" setup>
import loginImage from "@/assets/anomix.svg";
import { SelectOption, useMessage } from 'naive-ui';
import { AccountStatus } from '../../common/constants';

const { SdkState, loginAccount } = useSdk();
const { omitAddress } = useUtils();
const message = useMessage();
const { showLoadingMask, closeLoadingMask, setAccountPk58, setAlias, setAccountStatus, setSigningPk1_58, setSigningPk2_58 } = useStatus();

const maskId = 'session-login';
let selectedAccount = ref<string | undefined>(undefined);
let options = ref<SelectOption[]>([]);
let apiReadyChan: BroadcastChannel | null = null;

const handleUpdateValue = async (value: string, option: SelectOption) => {
    if (value === 'other') {
        await navigateTo("/");
        apiReadyChan?.close();
        return;
    }
};

const loadAccounts = async () => {
    console.log('start load accounts...');
    if (SdkState.remoteApi !== null) {
        const localAccounts = await SdkState.remoteApi!.getLocalAccounts();

        let acs: SelectOption[] = [];
        localAccounts.forEach((account) => {
            const address = omitAddress(account.accountPk)!;
            acs.push({
                label: account.alias ? account.alias + '.ano (' + address + ')' : address,
                value: account.accountPk,
                style: {
                    'height': '56px',
                }
            });
        });

        acs.push({
            label: "+ Use Other Account",
            value: 'other',
            style: {
                'color': '#000',
                'font-weight': '600',
                'align-items': 'center',
                'align-content': 'center',
                'justify-content': 'center',
                'height': '60px',
            }
        });
        options.value = acs;

        selectedAccount.value = options.value[0].value ? options.value[0].value + '' : undefined;
    } else {
        console.log('remoteApi is null');
    }
};

onMounted(async () => {
    console.log('session mounted...');
    await loadAccounts();

    if (options.value.length === 0) {
        console.log('options is empty, set remoteApiReady listener...');
        apiReadyChan = new BroadcastChannel('remoteApiReady');
        apiReadyChan.onmessage = async (ev: any) => {
            console.log('apiReady listener - receive message:', ev);
            await loadAccounts();
            apiReadyChan?.close();
        };
    }
    console.log('session mounted done');
});

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

const toAccountPage = async () => {
    console.log("to account page");
    await navigateTo("/account", { replace: true });
};

const toRegisterAliasPage = async () => {
    console.log("to register alias page");
    await navigateTo("/connect/step-2");
};

const login = async () => {
    const pwdTrim = pwd.value.trim();
    if (pwdTrim.length === 0) {
        message.error('Please input password');
        return;
    }
    if (selectedAccount.value === undefined) {
        message.error('Please select account');
        return;
    }

    try {
        showLoadingMask({ text: 'Login...', id: maskId, closable: false });
        const accountPk58 = selectedAccount.value!;
        const accountPrivateKey58 = await SdkState.remoteApi!.getSercetKey(accountPk58, pwdTrim);
        if (!accountPrivateKey58) {
            message.error('Password wrong');
            return;
        }

        // get alias
        const alias = await SdkState.remoteApi!.getAliasByAccountPublicKey(accountPk58, accountPrivateKey58);

        const pubKeys = await loginAccount(accountPk58, pwd.value, alias);
        if (pubKeys.length > 0) {
            setAccountPk58(accountPk58);
            if (alias) {
                setAlias(alias);
                setAccountStatus(AccountStatus.REGISTERED);
                message.success('Login successfully');
                await toAccountPage();
            } else {
                setAccountStatus(AccountStatus.UNREGISTERED);
                setSigningPk1_58(pubKeys[0]);
                setSigningPk2_58(pubKeys[1]);
                await toRegisterAliasPage();
            }

            closeLoadingMask(maskId);
        }
    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, { duration: 3000, closable: true });
    }
    apiReadyChan?.close();
}
</script>
<style scoped lang="scss">
.page-login {
    display: flex;
    flex-direction: column;
    margin-top: 46px;
    width: 100%;

    .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 5px;
        width: 100%;
        height: 140px;

        img {
            height: 100%;
        }
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

    .form-item {
        position: relative;

        .item-label {
            font-size: 16px;
            padding-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: 510;
            line-height: 26px;
        }

        .item {
            background: var(--ano-bg-checked);
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

        :deep(.n-base-selection-label) {
            height: 56px;
            background: var(--ano-bg-checked);
        }

        :deep(.n-base-selection) {
            border-radius: 12px;
        }

        :deep(.n-base-selection .n-base-suffix .n-base-suffix__arrow) {
            color: #000;
        }

    }

    .form-btn {
        margin-top: 50px;
        width: 100%;
        height: 52px;
        border-radius: 12px;
    }

    .session-login {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: flex-start;
        margin-top: 45px;
        width: 100%;
    }


}
</style>
