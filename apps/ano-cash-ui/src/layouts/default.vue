<template>
    <div class="ano-app">
        <div class="page">
            <slot />

            <div v-if="appState.mask.show" class="ano-mask" @click="closeCurrentLoadingMask">
                <template v-if="appState.mask.showLoading">
                    <n-spin stroke="white" size="large" style="z-index: 1000; color:#fff; font-size: 18px;" />

                    <div v-if="appState.mask.loadingText !== null"
                        style="text-align: center; z-index: 1000; color:#fff; font-size: 18px; margin-top: 16px; margin-left: 30px; margin-right: 30px;">
                        <div v-html="appState.mask.loadingText"></div>
                    </div>
                </template>

                <div v-if="appState.mask.showLoading === false && appState.mask.show"
                    style="z-index: 1000; color:#fff; font-size: 18px;">App Loading...</div>

            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
const { appState, closeLoadingMask } = useStatus();
const closeCurrentLoadingMask = () => {
    if (appState.value.mask.closable) {
        closeLoadingMask(appState.value.mask.id);
    }
};

</script>
