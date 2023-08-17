<template>
  <div class="up-app">
    <div class="page" style="justify-content: flex-start;">
      <div class="ano-header">
        <div class="left" @click="toBack">
          <van-icon name="arrow-left" size="24" />
          <!-- <div class="title">Deposit</div> -->
        </div>

      </div>

      <div class="operation-title">Claimable Assets</div>

      <div v-if="connectedWallet" class="connected-wallet">
        <div style="display: flex; align-items: center;">
          <img :src="auroLogo" alt="" style="width: 25px; height: 25px;" />
          <span style="color:black; padding-left: 10px; font-size: 16px;">{{ connectedWallet }}</span>
        </div>

        <van-icon name="cross" size="20" @click="disconnect" />
      </div>


      <div v-for="item in claimableNotes" class="claimable-item" @click="toClaim">

        <div class="ano-token">
          <div class="token">
            <div class="token-info">
              <van-icon :name="minaIcon" size="40" />
              <div class="token-name">MINA</div>
            </div>
            <div class="token-balance">
              {{ item.value }} MINA
            </div>
          </div>

          <div class="bottom">
            <div class="commitment">
              <n-tag :bordered="false" type="info">
                Note ID: {{ item.commitment }}
              </n-tag>
            </div>

            <div class="claim">
              <n-tag :bordered="false" type="info">
                claim
              </n-tag>
            </div>

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


const claimableNotes = [
  {
    token: 'MINA',
    value: 10.3,
    commitment: 'wegwegwegwegwegwg',
  },
  {
    token: 'MINA',
    value: 201,
    commitment: 'wegwegwegwegwegwg',
  },
  {
    token: 'MINA',
    value: 12.245,
    commitment: 'wegwegwegwegwegwg',
  },
];

const toClaim = () => {
  router.push("/claim/claim");
};

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
  router.push("/");
};

const toBack = () => history.back();
</script>

<style lang="scss" scoped>
.claimable-item {
  margin-top: 20px;
  padding: 15px;
  background: var(--up-bg);
  border-radius: 12px;

  .ano-token {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;

    .token {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;

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
        font-weight: 500;
        font-size: 16px;
        line-height: 28px;
        color: gray;
      }
    }

    .bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;

      .commitment {
        margin-top: 12px;
        font-size: 16px;
        font-weight: 500;
      }

      .claim {
        margin-top: 12px;
      }
    }


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
