<template>
  <div class="up-app">
    <div id="page-setting" class="page start">
      <div class="up-header">
        <div class="left" @click="toBack">
          <van-icon name="arrow-left" size="20" color="#1989fa" />
          <div class="title">Message</div>
        </div>
      </div>
      <div style="margin-top: 30px">
        <van-cell-group inset>
          <van-field label="L2txHash" model-value="1212" readonly />
          <van-field label="from" model-value="1212" readonly />
          <van-field label="to" model-value="1212" readonly />
          <van-field label="amount" model-value="1212" readonly />
          <van-field label="date" model-value="1212" readonly />
        </van-cell-group>
      </div>

      <van-button
        style="margin-top: 60px"
        size="large"
        block
        plain
        type="primary"
        @click="sign"
        >Sign</van-button
      >
    </div>
  </div>
</template>
<script lang="ts" setup>
const router = useRouter();

const columns = [
  { text: "English", value: "en" },
  { text: "Chinese", value: "cn" },
];

const sign = () => {};
const toBack = () => history.back();
</script>
<style lang="less" scoped>
.start {
  justify-content: start;
}

.up-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.up-header {
  justify-content: space-between;
}

.up-header,
.up-header > .left {
  display: flex;
  align-items: center;
}

.up-header > .left > .iconpark {
  cursor: pointer;
}

.up-header > .left > .icon-back {
  font-size: 24px;
}

.up-header > .left > .title {
  margin-left: 12px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.up-header > .right {
  display: flex;
  align-items: center;
}

.up-header > .right > .icon-more {
  cursor: pointer;
  font-size: 24px;
}
</style>
