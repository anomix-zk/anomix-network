<template>
    <div class="up-app">
        <div id="page-connect" class="page">
            <div class="header" @click="toBack">
                <van-icon name="arrow-left" size="20" color="#1989fa" />
            </div>
            <n-card :bordered="false" class="mt-4 stepCard">
                <n-space vertical class="steps" justify="center">
                    <Step1 v-if="currentTab === 1" @nextStep="nextStep" />
                    <Step2 v-if="currentTab === 2" @finish="finish" />
                    <!-- <Step3 v-if="currentTab === 3" @finish="finish" /> -->
                </n-space>
            </n-card>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import Step1 from "./components/Step1.vue";
import Step2 from "./components/Step2.vue";
// import Step3 from "./components/Step3.vue";

const currentStatus = ref("process");
const route = useRoute();
const router = useRouter();
const { step } = route.query;
const currentTab = ref(Number(step) || 1);
function nextStep() {
    if (currentTab.value < 3) {
        currentTab.value += 1;
    }
}

function prevStep() {
    if (currentTab.value > 1) {
        currentTab.value -= 1;
    }
}

function finish() {
    router.replace("/account");
}
const toBack = () => history.back();
</script>
<style lang="less" scoped>
.p {
}
</style>
