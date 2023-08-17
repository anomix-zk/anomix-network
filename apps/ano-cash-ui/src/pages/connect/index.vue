<template>
    <div class="up-app">
        <div id="page-connect" class="page" style="justify-content: flex-start;">

            <div class="header" @click="toBack">
                <van-icon name="arrow-left" size="24" color="#000" />
            </div>


            <n-space vertical class="steps" justify="center">
                <Step1 v-if="currentTab === 1" @nextStep="nextStep" />
                <Step2 v-if="currentTab === 2" @nextStep="nextStep" />
                <Step3 v-if="currentTab === 3" @finish="finish" />
            </n-space>

        </div>

    </div>
</template>

<script lang="ts" setup>
import Step1 from "./components/Step1.vue";
import Step2 from "./components/Step2.vue";
import Step3 from "./components/Step3.vue";

const route = useRoute();

console.log('state: ', route.query.ok);

const router = useRouter();
const { step } = route.query;
const isRegisterFlow = ref(false);

const currentTab = ref(Number(step) || 1);
function nextStep(step: number) {
    currentTab.value = step;
}


function finish() {
    router.replace("/account");
}


const externWalletAddress = ref('0xb299...37e9');
const accountPubKey = ref('');
const alias = ref('');

const disconnect = () => {
    externWalletAddress.value = '';
    router.push('/');
}

const toBack = () => {
    if (currentTab.value === 1) {
        history.back();
    } else {
        currentTab.value = currentTab.value - 1;
    }

};
</script>

<style lang="scss" scoped>
.steps {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: center;
}
</style>
