<template>
  <div class="up-app">
    <div class="page" style="justify-content: flex-start;">
      <div class="ano-header">
        <div class="left" @click="toBack">
          <van-icon name="arrow-left" size="24" />
          <!-- <div class="title">Deposit</div> -->
        </div>

      </div>

      <div class="operation-title">Claim Assets</div>

      <div v-if="connectedWallet" class="connected-wallet">
        <div style="display: flex; align-items: center;">
          <img :src="auroLogo" alt="" style="width: 25px; height: 25px;" />
          <span style="color:black; padding-left: 10px; font-size: 16px;">{{ connectedWallet }}</span>
        </div>

        <van-icon name="cross" size="20" @click="disconnect" />
      </div>


      <div class="send-form">

        <div class="form-main">

          <div class="title">Claimable Assets</div>

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

            <div class="label">Claimable Address</div>

            <div class="to-item">
              B62qkT3U75QVgmWjgfpcgT9Yc3ni6frTprX6cP1KRjmvVoFf8Wz8L1b
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

        <n-button v-if="connectedWallet" type="info" class="form-btn" style="margin-bottom: 20px;">
          Claim
        </n-button>

        <div v-if="!connectedWallet" class="oauth-box">
          <div class="auth-item">
            <n-button color="#f4f4f4" block type="primary" class="auth-btn" @click="connect">
              <div style="display:flex; align-items: center;">
                <img :src="auroLogo" alt="" style="width: 30px; height: 30px;" />
                <span style="color:#1f202a">Connect Wallet</span>
              </div>
            </n-button>
          </div>
        </div>


      </div>


    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui'
import minaIcon from "@/assets/mina.svg";
import auroLogo from "@/assets/auro.png";

const router = useRouter();
const { appState, setConnectedWallet } = useStatus();
const { omitAddress, checkNoSideSpace } = useUtils();
const message = useMessage();

const depositAmount = ref<number | undefined>(undefined);
const receiver = ref('');

const checkPositiveNumber = (x: number) => x > 0;

const connect = async () => {
  console.log('connect wallet...');
  if (!window.mina) {
    message.error(
      "Please install auro wallet browser extension first.",
      {
        closable: true,

      }
    );

    return;
  }

  const currentNetwork = await window.mina.requestNetwork();
  if (appState.value.minaNetwork !== currentNetwork) {
    message.error(
      `Please switch to the correct network (${appState.value.minaNetwork}) first.`,
      {
        closable: true,

      }
    );

    return;
  }

  try {
    let accounts = await window.mina.requestAccounts();
    setConnectedWallet(accounts[0]);
    message.success(
      "Connect wallet successfully.",
      {
        closable: true,

      }
    );
  } catch (err: any) {
    // if user reject, requestAccounts will throw an error with code and message filed
    console.log(err.message, err.code);
    message.error(
      err.message,
      {
        closable: true,

      }
    );

  }


  // TODO: get connected wallet balance
};

const connectedWallet = computed(() => {
  if (appState.value.connectedWallet58) {
    return omitAddress(appState.value.connectedWallet58);
  }

  return undefined;
});

const maxInputAmount = () => {
  depositAmount.value = 100;
};
const disconnect = () => {
  setConnectedWallet(undefined);
};

const toBack = () => history.back();
</script>

<style lang="scss" scoped>
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
    font-size: 16px;
    line-height: 28px;
  }

}


.send-form {

  .form-main {
    margin-top: 20px;
    padding: 20px;
    background: var(--up-bg);
    border-radius: 12px;
    margin-bottom: 40px;

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
        margin-top: 20px;
        margin-bottom: 20px;
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

.oauth-box {
  width: 100%;

  .auth-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    span {
      margin-left: 10px;
      font-weight: 600;
      font-size: 16px;
      line-height: 24px;
    }

    .auth-btn {
      height: 60px;
      display: flex;
      flex-wrap: nowrap;
      justify-content: center;
      align-items: center;
      align-content: center;
      border-radius: 12px;

      // border-color: #000;
      // border-width: 0.5px;
      // border-style: dashed;
    }
  }

  .auth-item+.auth-item {
    margin-top: 20px;
  }
}

.connected-wallet {
  cursor: pointer;
  width: 100%;
  display: flex;
  justify-content: space-between;
  color: #000;
  border-radius: 12px;
  height: 56px;
  line-height: 56px;
  border-width: 1px;
  background-color: #f7f7f7;
  padding: 0 15px;
  font-size: 16px;
  align-items: center;
  margin-top: 20px;
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
