<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
        <!-- <div class="title">Deposit</div> -->
      </div>

    </div>

    <div class="operation-title">Claimable Assets</div>

    <div v-if="connectedWallet !== null" class="connected-wallet">
      <div style="display: flex; align-items: center;">
        <img :src="auroLogo" alt="" style="width: 25px; height: 25px;" />
        <span style="color:black; padding-left: 10px; font-size: 16px;">{{ connectedWallet }}</span>
      </div>

      <van-icon name="cross" size="20" @click="disconnect" />
    </div>


    <div v-for="item in claimableNotes" class="claimable-item" @click="toClaim(item.commitment)">

      <div class="ano-token">
        <div class="token">
          <div class="token-info">
            <van-icon :name="minaIcon" size="40" />
            <div class="token-name">{{ item.token }}</div>
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

    <n-empty style="margin-top: 65px;" v-if="claimableNotes.length === 0" size="large"
      description="No claimable notes found" />

  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";
import auroLogo from "@/assets/auro.png";

const router = useRouter();
const { appState, setConnectedWallet } = useStatus();
const { omitAddress, convertToMinaUnit } = useUtils();
const message = useMessage();
const { SdkState } = useSdk();
const remoteApi = SdkState.remoteApi!;

const connectedWallet = computed(() => omitAddress(appState.value.connectedWallet58, 8));

const toBack = () => router.back();

const toClaim = (commitment: string) => {
  router.push(`/claim/${commitment}`);
};

const disconnect = () => {
  setConnectedWallet(null);
  router.replace("/");
};

let claimableNotes = ref<{ token: string; value: string; commitment: string }[]>([]);

onMounted(async () => {
  const cs = await remoteApi.getClaimableNotes(appState.value.connectedWallet58!, []);
  cs.forEach((c) => {
    claimableNotes.value.push({
      token: 'MINA',
      value: convertToMinaUnit(c.value)!.toString(),
      commitment: c.outputNoteCommitment
    });
  });

  if (window.mina) {
    window.mina.on('accountsChanged', (accounts: string[]) => {
      console.log('connected account change: ', accounts);
      if (accounts.length === 0) {
        setConnectedWallet(null);
        message.error('Please connect your wallet', {
          closable: true,
          duration: 0
        });
        router.replace('/');
      } else {
        setConnectedWallet(accounts[0]);
      }

    });

    window.mina.on('chainChanged', (chainType: string) => {
      console.log('current chain: ', chainType);
      if (chainType !== 'Berkeley') {
        message.error('Please switch to Berkeley network', {
          closable: true,
          duration: 0
        });
      }
    });
  }
});


</script>

<style lang="scss" scoped>
.claimable-item {
  margin-top: 20px;
  padding: 15px;
  background: var(--ano-bg);
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
          color: var(--ano-text-primary);
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
