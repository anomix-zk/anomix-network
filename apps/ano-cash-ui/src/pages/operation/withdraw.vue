<template>
  <div class="up-app">
    <div class="page" style="justify-content: flex-start;">
      <div class="ano-header">
        <div class="left" @click="toBack">
          <van-icon name="arrow-left" size="24" />
          <!-- <div class="title">Deposit</div> -->
        </div>

      </div>

      <div class="operation-title">Withdraw Assets</div>


      <div class="send-form">

        <div class="form-main">

          <div class="ano-token">

            <div class="token-icon">
              <van-icon :name="minaIcon" size="40" />
            </div>

            <div class="token-info">
              <div class="token-name">MINA</div>
              <div class="token-balance">Balance 0.0 MINA</div>
            </div>

          </div>

          <div class="amount">
            <n-input-number placeholder="Send amount" size="large" clearable :show-button="false"
              :validator="checkPositiveNumber" v-model:value="sendAmount">
              <template #suffix>
                <div class="max-btn" @click="maxInputAmount">MAX</div>
              </template>
            </n-input-number>
          </div>

          <div class="sendTo">

            <div class="label">To</div>

            <div class="to-input">
              <n-input placeholder="Mina address (B62)" size="large" clearable :allow-input="checkNoSideSpace"
                v-model:value="receiver">

              </n-input>
            </div>

          </div>

        </div>
        <!-- 
        <div class="tips">
          <div class="full-tips">
            Exchanges do not automatically detect native token deposits, so
            there is a risk of losing your assets
          </div>
        </div> -->

        <div class="fee-box">
          <div class="title">Tx Fee</div>
          <n-radio-group v-model:value="feeValue" name="radiogroup" style="width: 100%;">
            <div v-for="fee in fees" class="radio-item">
              <div class="left">{{ fee.kind }}</div>

              <div class="right">
                <div class="price">{{ fee.value }} MINA</div>
                <!-- <n-radio v-if="fee.kind === 'Normal'" default-checked :key="fee.kind" :value="fee.value" size="large" /> -->
                <n-radio :key="fee.kind" :value="fee.value" size="large" />
              </div>

            </div>
          </n-radio-group>
        </div>

        <n-button type="info" class="form-btn" style="margin-bottom: 20px;" @click="toConfirm">
          Next Step
        </n-button>


      </div>


    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui'
import minaIcon from "@/assets/mina.svg";
import auroLogo from "@/assets/auro.png";

const router = useRouter();
const { appState } = useStatus();
const { omitAddress, checkNoSideSpace } = useUtils();
const message = useMessage();

const sendAmount = ref<number | undefined>(undefined);
const receiver = ref('');

const checkPositiveNumber = (x: number) => x > 0;

const feeValue = ref<number | undefined>(undefined);
const fees = [
  {
    kind: 'Normal',
    value: 0.03
  },
  {
    kind: 'Fast',
    value: 0.09
  }
];

feeValue.value = fees[0].value;

const maxInputAmount = () => {
  sendAmount.value = 100;
};

const toBack = () => history.back();

const toConfirm = () => {
  router.push("/operation/confirm");
}

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

  .radio-item {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 15px;
    background-color: var(--up-background);

    .left {
      font-weight: 600;
    }

    .right {
      display: flex;

      .price {
        margin-right: 8px;
      }
    }
  }

  .radio-item:nth-child(odd) {
    border-bottom-style: dotted;
    border-bottom-width: 0.5px;
    border-bottom-color: var(--up-border);
  }
}

.send-form {

  .form-main {
    margin-top: 20px;
    padding: 20px;
    background: var(--up-bg);
    border-radius: 12px;
    margin-bottom: 40px;

    .ano-token {
      display: flex;
      align-items: center;
      flex-shrink: 0;

      .token-icon {
        position: relative;
        height: 40px;
        width: 40px;
      }

      .token-info {
        text-align: left;
        margin-left: 18px;

        .token-name {
          font-size: 16px;
          font-weight: 600;
          line-height: 24px;
        }

        .token-balance {
          margin-top: 2px;
          font-size: 14px;
          font-weight: 400;
          color: var(--up-text-third);
          line-height: 20px;
        }
      }

    }

    .amount {
      margin-top: 20px;

      .max-btn {
        border-left-width: 0.5px;
        border-left-style: dotted;
        border-left-color: var(--up-border);
        margin-left: 5px;
        padding-left: 14px;
        padding-right: 6px;
        font-size: 14px;
        font-weight: 500;
      }

      .max-btn:hover {
        color: var(--up-primary);
      }
    }

    .sendTo {
      .label {
        text-align: left;
        margin-top: 20px;
        margin-bottom: 20px;
        font-size: 20px;
        font-weight: 600;
        line-height: 20px;
      }

      // .to-input {
      //   margin-top: 32px;
      // }
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
