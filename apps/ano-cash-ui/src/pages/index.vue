<template>
  <div class="up-app">
    <div id="page-connect" class="page">
      <div class="page-login">
        <div class="logo">
          <img :src="loginImage" class="arrow" alt="" />
        </div>
        <h1 class="title">Login Money</h1>
        <!---->
        <div class="oauth-box">
          <div class="one">
            <van-button plain block type="primary" @click="connectLogin"
              ><span>Connect Wallet</span></van-button
            >
          </div>
          <div class="one">
            <van-button plain block type="primary" @click="accountLogin"
              ><span>Login With Key</span></van-button
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import loginImage from "@/assets/analysis.svg";

const router = useRouter();

function connectLogin() {
  router.push("/connect");
}
function accountLogin() {
  router.push("/login");
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
    font-size: 24px;
    line-height: 36px;
  }
  .title {
    display: inline-block;
    position: relative;
    width: 150px;
    white-space: nowrap;
    animation: typing 2.5s ease-in;
    overflow: hidden;
    color: #1989fa;
  }
  /* 打印效果 */
  @keyframes typing {
    from {
      width: 0;
    }
    to {
      width: 150px;
    }
  }

  .oauth-box {
    margin-top: 40px;
    width: 100%;
  }

  .oauth-box .one {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 1px 1px 3px var(--up-line);
  }

  .oauth-box .one + .one {
    margin-top: 20px;
  }

  .oauth-box .one span {
    margin-left: 10px;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
  }
}
</style>
