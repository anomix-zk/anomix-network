<template>
    <div class="step-content">
        <div class="h1" style="margin-bottom: 40px;">Derive Your Signing Keys</div>

        <template v-if="!signingPubKey1">
            <n-alert type="info" style="width:100%; margin-bottom: 15px;">
                Clicking the button below will trigger the auro wallet extension to perform signature authorization and
                export Signing Keys, please feel free to operate
            </n-alert>
            <n-button type="info" class="form-btn" @click="deriveKeys">
                derive keys
            </n-button>
        </template>

        <div v-if="signingPubKey1">
            <div class="label">Signing PublicKey 1</div>
            <div class="item">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ signingPubKey1 }}</span>
            </div>
        </div>

        <div v-if="signingPubKey2">
            <div class="label">Signing PublicKey 2</div>
            <div class="item">
                <span style="color:black; padding-left: 10px; font-size: 16px;">{{ signingPubKey2 }}</span>
            </div>
        </div>

        <n-button v-if="signingPubKey1" type="info" class="form-btn" @click="nextStep">
            Next Step
        </n-button>
    </div>
</template>

<script lang="ts" setup>

const signingPubKey1 = ref('');
const signingPubKey2 = ref('');


const emit = defineEmits<{
    (e: 'nextStep', step: number): void;
}>();
const nextStep = () => {
    emit('nextStep', 3);
};
const deriveKeys = () => {
    signingPubKey1.value = '0x0b299...37e9';
    signingPubKey2.value = '0x0b299...37e9';
};

const alias = ref("");
const wordkey = ref("");
const show = ref(true);
const isUsed = ref(false);

function cancel() {
    show.value = false;
}
function confirm() {
    console.log(wordkey.value);
    show.value = false;
}

function formSubmit(values: any) {
    console.log(alias.value);
    emit("finish");
}
</script>
<style lang="less" scoped>
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
