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

            </div>
            <div class="index">
              <div class="index-title">MINA</div>
              <div class="index-subtitle">Balance 0.0 MINA</div>
              <!---->
            </div>
          </div>
          <div class="el-form-item is-required asterisk-left amount up-form-item amount">
            <!--v-if-->
            <div class="el-form-item__content">
              <n-input round placeholder="100,000,000" size="large" v-model:value="input1" />

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
        <van-button style="margin-top: 60px" size="large" block round plain type="primary"
          @click="handleWithdraw">Next</van-button>
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
