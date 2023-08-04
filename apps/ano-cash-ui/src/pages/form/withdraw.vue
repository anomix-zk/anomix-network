<template>
  <div class="up-app">
    <div id="page-send" class="page-sign page start">
      <div class="up-header">
        <div class="left" @click="toback">
          <van-icon name="arrow-left" size="20" color="#1989fa" />
          <div class="title">Deposit</div>
        </div>

        <div class="right"><!----></div>
      </div>
      <form class="el-form el-form--default el-form--label-right send-form">
        <div class="token">
          <div class="up-token index">
            <div class="token-box">
              <n-icon size="20">
                <svg
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  fill="none"
                  viewBox="0 0 41 40"
                >
                  <!--?lit$2550565373$-->
                  <g>
                    <circle fill="#8247E5" r="20" cy="20" cx="20.714"></circle>
                    <path
                      fill="#fff"
                      d="M27.341 15.781c-.45-.258-1.03-.258-1.545 0l-3.607 2.126-2.448 1.352-3.543 2.126c-.45.257-1.03.257-1.546 0l-2.77-1.675a1.57 1.57 0 0 1-.772-1.353v-3.22c0-.515.257-1.03.773-1.353l2.77-1.61c.45-.258 1.03-.258 1.545 0l2.77 1.675c.45.257.773.773.773 1.352v2.126l2.448-1.417v-2.19c0-.516-.258-1.03-.773-1.353L16.263 9.34c-.451-.258-1.03-.258-1.546 0l-5.282 3.092c-.515.257-.773.772-.773 1.288v6.054c0 .516.258 1.031.773 1.353l5.217 3.027c.451.258 1.031.258 1.546 0l3.543-2.06 2.448-1.418 3.542-2.06c.451-.259 1.03-.259 1.546 0l2.77 1.61c.45.257.773.772.773 1.352v3.22a1.59 1.59 0 0 1-.773 1.353l-2.706 1.61c-.45.258-1.03.258-1.545 0l-2.77-1.61a1.57 1.57 0 0 1-.773-1.352v-2.062l-2.448 1.418v2.125c0 .515.258 1.03.773 1.353l5.218 3.027c.45.258 1.03.258 1.545 0l5.218-3.027a1.57 1.57 0 0 0 .773-1.353v-6.119c0-.515-.258-1.03-.773-1.353l-5.218-3.027Z"
                      data-follow-fill="#fff"
                    ></path>
                  </g>
                </svg>
              </n-icon>
            </div>
            <div class="index">
              <div class="index-title">MATIC</div>
              <div class="index-subtitle">Balance 0.0 MATIC</div>
              <!---->
            </div>
          </div>
          <div
            class="el-form-item is-required asterisk-left amount up-form-item amount"
          >
            <!--v-if-->
            <div class="el-form-item__content">
              <n-input
                round
                placeholder="100,000,000"
                size="large"
                v-model:value="input1"
              />

              <!--v-if-->
            </div>
          </div>
        </div>
        <div class="tips">
          <div class="full-tips">
            Exchanges do not automatically detect native token deposits, so
            there is a risk of losing your assets
          </div>
        </div>
        <van-button
          style="margin-top: 60px"
          size="large"
          block
          round
          plain
          type="primary"
          @click="handleWithdraw"
          >Next</van-button
        >
      </form>
    </div>
  </div>
</template>
<script lang="ts" setup>
const input1 = ref("");
const router = useRouter();
const toback = () => {
  router.push("/account");
};
const handleWithdraw = () => {
  console.log(input1.value);
};
</script>
<style lang="less" scoped>
.start {
  justify-content: flex-start;
}
.up-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.up-token {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  .token-box {
    position: relative;
    height: 40px;
    width: 40px;
  }
  .box-icon {
    width: 100%;
    height: 100%;
    display: inline-block;
    border-radius: 50%;
    overflow: hidden;
  }
  .box-token {
    font-size: 40px;
  }
  .box-chain {
    border-radius: 50%;
    position: absolute;
    right: -6px;
    bottom: 0;
    font-size: 20px;
    border: 1px solid #fff;
    background: #fff;
  }
  .name {
    margin-left: 18px;
    color: var(--up-text-primary);
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
  }
}

.up-token .overage {
  margin-left: 20px;
}

.up-token .overage .token-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--up-text-primary);
  line-height: 16px;
}

.up-token .overage .token-overage {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--up-text-third);
  line-height: 12px;
}

.up-token.index .index {
  text-align: left;
  margin-left: 18px;
}

.up-token.index .index .index-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.up-token.index .index .index-subtitle {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 400;
  color: var(--up-text-third);
  line-height: 20px;
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
.send-form {
  .label {
    text-align: left;
    margin-top: 32px;
    font-size: 20px;
    font-weight: 600;
    line-height: 20px;
  }
  .token {
    margin-top: 20px;
    padding: 20px;
    background: var(--up-bg);
    border-radius: 12px;
  }

  .amount {
    margin-top: 20px;
  }

  .up-input {
    font-size: 20px;
    font-weight: 600;
    color: var(--up-text-third);
    .dollar {
      font-size: 14px;
      font-weight: 400;
      color: var(--up-text-third);
    }
    .line {
      margin: 16px;
      width: 1px;
      height: 18px;
      border: 1px solid var(--up-line);
    }
    .el-button {
      font-size: 16px;
      font-weight: 400;
    }
  }

  .to-address {
    margin-top: 20px;
  }

  .icon-loading {
    font-size: 15px;
    margin-right: 8px;
  }

  .tips {
    text-align: left;
    margin-top: 12px;
    span {
      color: var(--up-primary);
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
    }
    .icon {
      position: relative;
      top: 4px;
      margin-right: 8px;
      margin-top: 2px;
      cursor: pointer;
    }
    .full-tips {
      font-size: 12px;
      line-height: 20px;
      color: var(--up-text-third);
      margin-top: 4px;
    }
  }

  .to-domain-success {
    margin-top: 12px;
    text-align: left;
    color: #4aac4c;
    font-weight: 450;
    font-size: 14px;
    line-height: 20px;
  }

  .submit {
    margin-top: 40px;
  }
}
</style>
