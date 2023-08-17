<template>
    <div class="up-app">
        <div class="page" style="justify-content: flex-start; align-items: flex-start;">

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
                                size="large" :placeholder="placeholderPwd" :maxlength="30" @blur="blurPwd"
                                @input="inputPwd" />
                        </div>
                    </n-space>

                    <n-button type="info" class="form-btn">
                        Login
                    </n-button>
                </div>



            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { SelectOption } from 'naive-ui';


const router = useRouter();
const privateKey = ref("");

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

const existAccount = ref(true);
const selectedAccount = ref('');
const options = [
    {
        label: "Vitalik(0xb284...65e4)",
        value: 'song0',
        style: {
            'height': '56px',
        }
    },
    {
        label: "0xb299...37e9",
        value: 'song1',
        style: {
            'height': '56px',
        }
    },
    {
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
    }
];

selectedAccount.value = options[0].value;

function handleUpdateValue(value: string, option: SelectOption) {
    if (value === 'other') {
        router.push("/");
    }
}

function formSubmit(values: any) {
    console.log(privateKey.value);
    router.push("/connect?step=2");
}
const toBack = () => history.back();
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
            background: var(--up-bg-checked);
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

        :deep(.n-base-selection-label) {
            height: 56px;
            background: var(--up-bg-checked);
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
