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
            Note ID: {{ omitAddress(item.commitment, 5) }}
          </div>

          <div class="claim">
            Claimable
          </div>

        </div>

      </div>

    </div>

    <n-empty style="margin-top: 120px;" v-if="claimableNotes.length === 0" size="large"
      description="No claimable notes found" />

    <div v-if="connectedWallet === null" class="oauth-box" style="margin-top: 120px;">
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
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";
import auroLogo from "@/assets/auro.png";

import { CHANNEL_MINA, WalletEventType } from '../../common/constants';
import type { WalletEvent } from '../../common/types';
const router = useRouter();
const { appState, setConnectedWallet, showLoadingMask, closeLoadingMask, setStartCompileVaultContract } = useStatus();
const { omitAddress, convertToMinaUnit } = useUtils();
const message = useMessage();
const { SdkState } = useSdk();
const remoteApi = SdkState.remoteApi!;
const remoteSdk = SdkState.remoteSdk!;

// show laoding mask when init
const maskId = "claimable";
showLoadingMask({ text: 'Loading...', id: maskId, closable: false });

const connectedWallet = computed(() => omitAddress(appState.value.connectedWallet58, 8));

let walletChannel: BroadcastChannel | null = null;
const toBack = () => {
  walletChannel?.close();
  router.back();
};

const toClaim = async (commitment: string) => {
  walletChannel?.close();
  await navigateTo(`/claim/${commitment}`);
};

const disconnect = () => {
  setConnectedWallet(null);
  claimableNotes.value = [];
};

const claimableNotes = ref<{ token: string; value: string; commitment: string }[]>([]);
const loadClaimableNotesByConnectedWallet = async () => {
  console.log('claimable.vue - loadClaimableNotesByConnectedWallet: ', appState.value.connectedWallet58);
  const cs = await remoteApi.getClaimableNotes([], appState.value.connectedWallet58!);

  let notes: { token: string; value: string; commitment: string }[] = [];
  cs.forEach((c) => {
    notes.push({
      token: 'MINA',
      value: convertToMinaUnit(c.value)!.toString(),
      commitment: c.outputNoteCommitment
    });
  });
  claimableNotes.value = notes;
};


const connect = async () => {
  console.log('connect wallet...');
  if (!window.mina) {
    message.error('Please install auro wallet browser extension first.');
    return;
  }

  showLoadingMask({ text: 'Connecting...', id: maskId, closable: true });
  try {
    const currentNetwork = await window.mina.requestNetwork();
    if (appState.value.minaNetwork !== currentNetwork && currentNetwork !== 'Unknown') {
      closeLoadingMask(maskId);
      message.error(`Please switch to the correct network (${appState.value.minaNetwork}) first.`);
      return;
    }

    let accounts = await window.mina.requestAccounts();
    setConnectedWallet(accounts[0]);

    showLoadingMask({ text: 'Loading claimable notes...', id: maskId, closable: false });
    await loadClaimableNotesByConnectedWallet();
  } catch (err: any) {
    // if user reject, requestAccounts will throw an error with code and message filed
    console.error(err);
    message.error(err.message);
  }

  closeLoadingMask(maskId);
};

const walletListenerSetted = ref(false);
onMounted(async () => {
  console.log('claimable.vue - onMounted: ', appState.value.connectedWallet58);

  try {
    await loadClaimableNotesByConnectedWallet();

    if (!walletListenerSetted.value) {
      walletChannel = new BroadcastChannel(CHANNEL_MINA);
      walletChannel.onmessage = async (e: any) => {
        const event = e.data as WalletEvent;
        console.log('claimable - walletChannel.onmessage: ', event);
        if (event.eventType === WalletEventType.ACCOUNTS_CHANGED) {

          if (event.connectedAddress) {
            setConnectedWallet(event.connectedAddress);
            await loadClaimableNotesByConnectedWallet();

          } else {
            message.error('Please connect your wallet', {
              closable: true,
              duration: 2000
            });
            disconnect();
          }

        } else if (event.eventType === WalletEventType.NETWORK_INCORRECT) {
          message.error(`Please switch to ${appState.value.minaNetwork} network`, {
            closable: true,
            duration: 3000
          });
        }
      };

      walletListenerSetted.value = true;
    }

    if (!appState.value.startCompileVaultContract) {
      console.log('VaultContract not found to start compilation, will start soon');
      setStartCompileVaultContract(true);
      remoteSdk.compileVaultContract();
    } else {
      console.log('VaultContract is already being compiled, no need to recompile')
    }

  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 5000, closable: true });
  }

  closeLoadingMask(maskId);
});


</script>

<style lang="scss" scoped>
.claimable-item {
  margin-top: 20px;
  padding: 15px;
  background: var(--ano-bg);
  border-radius: 12px;
  border-width: 0.5px;
  border-style: solid;
  cursor: pointer;

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
        font-size: 14px;
        font-weight: 500;
      }

      .claim {
        margin-top: 12px;
        font-size: 14px;
        border-radius: 12px;
        border-width: 0.5px;
        border-style: solid;
        border-radius: 5px;
        padding-left: 4px;
        padding-right: 4px;
        padding-top: 2px;
        padding-bottom: 2px;
        color: red;
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
