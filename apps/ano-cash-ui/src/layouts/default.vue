<template>
  <div class="view-account">
    <div class="view-account-header" @click="toIndex">Money</div>
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
  background-image: linear-gradient(0deg, #9fb8ad 0%, #1fc8db 51%, #2cb5e8 75%);
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
  min-width: 60vw;
}
</style>
