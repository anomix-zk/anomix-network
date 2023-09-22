<template>
    <div style="justify-content: flex-start; align-items: flex-start;">

        <div class="page-login">

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
                        <n-input v-model:value="pwd" class="item" clearable type="password" show-password-on="mousedown"
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
import type { SigningKey } from '@anomix/sdk';
import { SelectOption, useMessage } from 'naive-ui';
import { AccountStatus } from '../../common/constants';

const router = useRouter();
const { SdkState, loginAccount } = useSdk();
const remoteApi = SdkState.remoteApi!;
const { omitAddress } = useUtils();
const message = useMessage();
const { showLoadingMask, closeLoadingMask, setAccountPk58, setAlias, setAccountStatus } = useStatus();

const maskId = 'session-login';
let selectedAccount = ref<string | undefined>(undefined);
let options = ref<SelectOption[]>([]);
const handleUpdateValue = (value: string, option: SelectOption) => {
    if (value === 'other') {
        router.push("/");
        return;
    }
};
onMounted(async () => {
    const localAccounts = await remoteApi.getLocalAccounts();

    let acs: SelectOption[] = [];
    localAccounts.forEach((account) => {
        const address = omitAddress(account.accountPk)!;
        acs.push({
            label: account.alias ? account.alias + '(' + address + ')' : address,
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

const toAccountPage = () => {
    console.log("to account page");
    router.replace("/account");
};

const login = async () => {
    if (pwd.value.length === 0) {
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
        const accountPrivateKey58 = await remoteApi.getSercetKey(accountPk58, pwd.value);
        if (!accountPrivateKey58) {
            message.error('Password wrong');
            return;
        }

        // get alias
        const alias = await remoteApi.getAliasByAccountPublicKey(accountPk58, accountPrivateKey58);

        const accountPk = await loginAccount(accountPk58, pwd.value, alias);
        if (accountPk) {
            setAccountPk58(accountPk);
            if (alias) {
                setAlias(alias);
                setAccountStatus(AccountStatus.REGISTERED);
            } else {
                setAccountStatus(AccountStatus.UNREGISTERED);
            }
            closeLoadingMask(maskId);
            message.success('Login successfully');

            toAccountPage();
        }
    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, { duration: 0, closable: true });
    }

}
</script>
<style scoped lang="scss">
.page-login {
    display: flex;
    flex-direction: column;
    margin-top: 46px;
    width: 100%;
    // .logo {
    //     display: block;
    //     margin-top: 60px;
    //     width: 100%;
    //     height: 160px;

    //     img {
    //         height: 100%;
    //     }
    // }

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
