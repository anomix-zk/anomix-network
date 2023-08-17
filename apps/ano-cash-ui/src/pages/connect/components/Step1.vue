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

        <div v-if="accountPubKey">
            <div class="label">Anomix Account</div>
            <div class="item">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ accountPubKey }}</span>
            </div>
        </div>

        <div v-if="alias">
            <div class="label">Registered Alias</div>
            <div class="item">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ alias }}</span>
            </div>
        </div>

        <n-button v-if="!accountPubKey" type="info" class="form-btn" @click="deriveAccountPubKey">
            Derive Account Public Key
        </n-button>

        <n-button v-if="isRegisterFlow" type="info" class="form-btn" @click="regsiterAlias">
            Register Your Alias
        </n-button>

        <n-button v-if="!isRegisterFlow && accountPubKey" type="info" class="form-btn" @click="deriveAccountPubKey">
            Next Step
        </n-button>
    </div>
</template>

<script lang="ts" setup>
import step1 from "@/assets/step.jpg";
import auroLogo from "@/assets/auro.png";

const emit = defineEmits<{
    (e: 'nextStep', step: number): void;
}>();
const route = useRoute();
const router = useRouter();

const externWalletAddress = ref('0xb299...37e9');
const accountPubKey = ref('');
const alias = ref('');
const isRegisterFlow = ref(false);

const disconnect = () => {
    externWalletAddress.value = '';
    router.push('/');
};

const deriveAccountPubKey = () => {
    accountPubKey.value = '0x0b299...37e9';
    alias.value = 'Alice';
    isRegisterFlow.value = true;
};

const regsiterAlias = () => {
    emit('nextStep', 2);
};

async function formSubmit() {
    try {
        emit("nextStep", 2);

    } catch (err) {
        console.log(err);
    }
}
</script>
<style lang="scss" scoped>
.step-content {
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    width: 100%;
    text-align: center;

    .form-btn {
        margin-top: 40px;
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
