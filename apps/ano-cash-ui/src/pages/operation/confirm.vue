<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
        <!-- <div class="title">Deposit</div> -->
      </div>

    </div>

    <div class="operation-title">Confirm Transaction</div>


    <div class="send-form">

      <div class="form-main">

        <div class="title">Send Assets</div>

        <div class="ano-token">

          <div class="token-info">
            <van-icon :name="minaIcon" size="40" />
            <div class="token-name">MINA</div>
          </div>

          <div class="token-balance">
            0.0 MINA
          </div>

        </div>


        <div class="sendTo">

          <div class="label">To</div>

          <div class="to-item">
            B62qkT3U75QVgmWjgfpcgT9Yc3ni6frTprX6cP1KRjmvVoFf8Wz8L1b <span style="font-weight: 600;">(Alice.ano)</span>
          </div>

        </div>

      </div>


      <div class="fee-box">
        <div class="title">Tx Fee</div>

        <div class="ano-token">

          <div class="token-info">
            <van-icon :name="minaIcon" size="40" />
            <div class="token-name">MINA</div>
          </div>

          <div class="token-balance">
            0.0 MINA
          </div>

        </div>
      </div>

      <n-button type="info" class="form-btn" style="margin-bottom: 20px;">
        Confirm
      </n-button>


    </div>


  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";


const router = useRouter();
const message = useMessage();



const toBack = () => router.back();
</script>

<style lang="scss" scoped>
.fee-box {
  margin-top: 20px;
  padding: 20px;
  background: var(--up-bg);
  border-radius: 12px;
  margin-bottom: 40px;
  color: var(--up-text-primary);

  .title {
    color: var(--up-text-primary);
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    margin-bottom: 20px;
  }

}

.ano-token {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;

  .token-info {
    display: flex;
    align-items: center;

    .token-name {
      margin-left: 10px;
      color: var(--up-text-primary);
      font-weight: 500;
      font-size: 16px;
      line-height: 24px;
    }
  }

  .token-balance {
    text-align: left;
    font-weight: 600;
    font-size: 18px;
    line-height: 28px;
  }

}

.send-form {

  .form-main {
    margin-top: 20px;
    padding: 20px;
    background: var(--up-bg);
    border-radius: 12px;
    margin-bottom: 20px;

    .title {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      font-size: 20px;
      line-height: 28px;
      margin-bottom: 20px;
    }


    .sendTo {
      .label {
        text-align: left;
        margin-top: 25px;
        margin-bottom: 25px;
        font-size: 20px;
        font-weight: 600;
        line-height: 20px;
      }

      .to-item {
        font-size: 15px;
        font-weight: 500;
      }
    }


  }



  .form-btn {
    width: 100%;
    height: 52px;
    border-radius: 12px;
  }

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

  .full-tips {
    font-size: 12px;
    line-height: 20px;
    color: var(--up-text-third);
    margin-top: 4px;
  }
}

.operation-title {
  text-align: left;
  margin-top: 32px;
  font-size: 20px;
  font-weight: 600;
  line-height: 20px;
}

.ano-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ano-header>.left {
  display: flex;
  align-items: center;
}

.ano-header>.left>.title {
  margin-left: 12px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.ano-header>.right {
  display: flex;
  align-items: center;
}
</style>
