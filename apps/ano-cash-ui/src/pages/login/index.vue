<template>
  <div class="up-app">
    <div id="page-connect" class="page">
      <div class="page-login">
        <div class="logo">
          <img :src="loginImage" class="arrow" alt="" />
        </div>
        <h1 class="title" data-text="Input your private key">
          Input your private key
        </h1>
        <!---->
        <van-form @submit="formSubmit" class="textarea">
          <van-cell-group inset>
            <van-field
              type="textarea"
              v-model="privateKey"
              label="Private Key:"
              placeholder="input"
              rows="3"
              autosize
              clearable
            />
          </van-cell-group>
          <div style="margin-top: 30px">
            <van-button round type="primary" native-type="submit">
              Submit
            </van-button>
          </div>
        </van-form>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import loginImage from "@/assets/analysis.svg";
import { ref } from "vue";
const router = useRouter();
const privateKey = ref("");
function formSubmit(values: any) {
  console.log(privateKey.value);
  router.push("/connect?step=2");
}
</script>
<style lang="less" scoped>
.page-login {
  .logo {
    display: block;
    margin-top: 60px px;
    width: 100%;
    height: 160px;

    img {
      height: 100%;
    }
  }

  h1 {
    margin-top: 24px;
    font-weight: 700;
    font-size: 18px;
    line-height: 36px;
  }

  .textarea {
    margin-top: 20px;
  }
}
</style>
