<template>
  <div class="up-app">
    <div id="page-setting" class="page start">
      <div class="up-header">
        <div class="left" @click="toBack">
          <van-icon name="arrow-left" size="20" color="#1989fa" />
          <div class="title">Setting</div>
        </div>

        <div class="right"><!----></div>
      </div>
      <div style="margin-top: 30px">
        <van-field v-model="lan" is-link readonly label="Language" placeholder="select language"
          @click="showPicker = true" />
      </div>
      <van-popup v-model:show="showPicker" round position="bottom" style="position: absolute">
        <van-picker :columns="columns" confirm-button-text="confirm" cancel-button-text="cancel"
          @cancel="showPicker = false" @confirm="onConfirm" />
      </van-popup>

      <van-button style="margin-top: 60px" size="large" block plain type="primary" @click="logout">Log out</van-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
const router = useRouter();

const columns = [
  { text: "English", value: "en" },
  { text: "Chinese", value: "cn" },
];
const lan = ref("en");
const showPicker = ref(false);

const onConfirm = ({ selectedOptions }) => {
  showPicker.value = false;
  lan.value = selectedOptions[0].text;
  console.log(selectedOptions[0].value);
};
const logout = () => {
  router.push("/");
};
const toBack = () => history.back();
</script>
<style lang="scss" scoped>
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
.up-header>.left {
  display: flex;
  align-items: center;
}

.up-header>.left>.iconpark {
  cursor: pointer;
}

.up-header>.left>.icon-back {
  font-size: 24px;
}

.up-header>.left>.title {
  margin-left: 12px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.up-header>.right {
  display: flex;
  align-items: center;
}

.up-header>.right>.icon-more {
  cursor: pointer;
  font-size: 24px;
}
</style>
