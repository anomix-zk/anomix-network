<template>
    <div class="view-account">
        <!-- <div class="view-account-header" @click="toIndex">Money</div> -->
        <div class="homeWrapper"><slot /></div>
    </div>
</template>
<script lang="ts" setup>
const router = useRouter();
const toIndex = () => {
    router.replace("/");
};
</script>

<style lang="less" scoped>
.view-account {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: auto;
    background-color: #f3f3f3;
    &-header {
        margin-top: 20px;
        margin-left: 40px;
        font-size: 40px;
        color: #fff;
        cursor: pointer;
    }
}
.homeWrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    min-width: 60vw;
}
</style>
