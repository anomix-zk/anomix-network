<template>
    <div style="justify-content: flex-start;">

        <div class="header" @click="toBack">
            <van-icon name="arrow-left" size="24" color="#000" />
        </div>


        <n-space vertical class="steps" justify="center">
            <Step1 v-if="currentTab === 1" @nextStep="nextStep" />
            <Step2 v-if="currentTab === 2" @finish="finish" />
        </n-space>

    </div>
</template>

<script lang="ts" setup>
import Step1 from "./components/Step1.vue";
import Step2 from "./components/Step2.vue";

const route = useRoute();
const router = useRouter();

const { step } = route.params;
console.log('step:', step);
const currentTab = ref(Number(step) || 1);

const nextStep = (step: number) => {
    currentTab.value = step;
};
const finish = async () => {
    await navigateTo("/account", { replace: true });
};

const toBack = () => router.back();
</script>

<style lang="scss" scoped>
.steps {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: center;
}
</style>
