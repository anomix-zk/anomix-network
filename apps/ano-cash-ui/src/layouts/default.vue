<template>
    <div class="ano-app">
        <div class="page">
            <slot />

            <div v-if="appState.mask.show" class="ano-mask" @click="closeCurrentLoadingMask">
                <n-spin v-if="appState.mask.showLoading" :description="appState.mask.loadingText" stroke="white"
                    size="large"
                    style="z-index: 1000; color:#fff; font-size: 18px;padding-left: 30px;padding-right: 30px;" />
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
