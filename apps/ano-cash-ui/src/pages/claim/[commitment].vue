<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
        <!-- <div class="title">Deposit</div> -->
      </div>

    </div>

    <div class="operation-title">Claim Assets</div>

    <div v-if="connectedWallet !== null" class="connected-wallet">
      <div style="display: flex; align-items: center;">
        <img :src="auroLogo" alt="" style="width: 25px; height: 25px;" />
        <span style="color:black; padding-left: 10px; font-size: 16px;">{{ connectedWallet }}</span>
      </div>

      <div style="display: flex; align-items: center;">
        <div v-if="L1TokenBalance !== null" style="margin-right: 10px;">{{ L1TokenBalance?.balance }} {{
          L1TokenBalance?.token }}</div>
        <van-icon name="cross" size="20" @click="disconnect" />
      </div>
    </div>


    <div class="send-form">

      <div class="form-main">

        <div class="title">Claimable Assets</div>

        <div class="ano-token">
          <div class="token-info">
            <van-icon :name="minaIcon" size="40" />
            <div class="token-name">{{ withdrawNote?.token }}</div>
          </div>
          <div class="token-balance">
            {{ withdrawNoteBalance }} {{ withdrawNote?.token }}
          </div>
        </div>


        <div class="sendTo">
          <div class="label">Claimable Address</div>
          <div class="to-item">
            {{ withdrawNote?.ownerAddress }}
          </div>
        </div>

      </div>


      <n-button :disabled="disabledClaim"
        v-if="withdrawNote !== null && connectedWallet !== null && withdrawAccountExists" type="info" class="form-btn"
        style="margin-bottom: 20px;" @click="claim">
        <template v-if="!claimLoading">
          {{ claimBtnText }}
        </template>
        <template v-else>
          <n-spin size="small" />
        </template>
      </n-button>

      <div v-if="withdrawNote !== null && connectedWallet !== null && !withdrawAccountExists">
        <n-alert title="Notice" type="info" style="margin-bottom: 15px;">
          It is the first time you claim funds, you need to create a withdrawal account before you can continue to
          operate,
          creating a withdrawal account needs to consume one mina (collected by the mina network), this operation only
          needs
          to be performed once.
        </n-alert>
        <n-button :disabled="createWithdrawalAccountLoading" type="info" class="form-btn" style="margin-bottom: 20px;"
          @click="createWithdrawalAccount">
          <template v-if="!createWithdrawalAccountLoading">
            Create Withdrawal Account
          </template>
          <template v-else>
            <n-spin size="small" />
          </template>
        </n-button>
      </div>

      <n-alert v-if="checkTxUrl !== null" title="Notice" type="info" style="margin-bottom: 15px;">
        The transaction has been sent, please check the transaction status: <a :href="checkTxUrl" target="_blank">{{
          checkTxUrl }}</a>
      </n-alert>

      <div v-if="connectedWallet === null" class="oauth-box">
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
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";
import auroLogo from "@/assets/auro.png";
import { SdkEvent } from '../../common/types';
import { SdkEventType } from '../../common/constants';

const router = useRouter();
const { appState, setConnectedWallet } = useStatus();
const { omitAddress, convertToMinaUnit } = useUtils();
const message = useMessage();
const route = useRoute();
const { SdkState, listenSyncerChannel } = useSdk();
const remoteApi = SdkState.remoteApi!;
const remoteSdk = SdkState.remoteSdk!;

const checkTxUrl = ref<string | null>(null);

const commitment = route.params.commitment as string;
console.log('claim-commitment: ', commitment);

const connectedWallet = computed(() => omitAddress(appState.value.connectedWallet58, 5));
const withdrawNote = ref<{ token: string; balance: string; ownerAddress: string } | null>(null);
const withdrawNoteBalance = computed(() => {
  if (withdrawNote.value === null) return '0.0';
  return convertToMinaUnit(withdrawNote.value.balance);
});
const withdrawAccountExists = ref<boolean>(false);
const L1TokenBalance = ref<{ token: string; balance: string } | null>(null);
const createWithdrawalAccountLoading = ref<boolean>(false);
const claimLoading = ref<boolean>(false);
const disabledClaim = ref<boolean>(false);
const claimBtnText = ref('Claim');

const toBack = () => router.back();
const syncerListenerSetted = ref(false);

const claim = async () => {
  console.log('claim funds...');
  if (!window.mina) {
    message.error('Please install auro wallet browser extension first.');
    return;
  }

  if (withdrawNote.value?.ownerAddress !== appState.value.connectedWallet58) {
    message.error('Please connect to the wallet that is consistent with note’s ownerAddress.');
    return;
  }

  disabledClaim.value = true;
  claimLoading.value = true;
  try {
    const isContractReady = await remoteSdk.isVaultContractCompiled();
    if (!isContractReady) {
      message.error('Anomix Vault contract is not ready, please try again later. If it is ready, you will receive a message notification.');
      disabledClaim.value = false;
      claimLoading.value = false;
      return;
    }
    const txJson = await remoteSdk.createClaimFundsTx(commitment, appState.value.connectedWallet58!);
    const { hash: txHash } = await window.mina.sendTransaction({
      transaction: txJson,
    });
    console.log('tx send success, txHash: ', txHash);

    checkTxUrl.value = appState.value.explorerUrl + txHash;
    await remoteApi.checkTx(txHash);
    message.success('Claim funds success.');
    claimBtnText.value = 'Claimed';
    claimLoading.value = false;

  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
    claimLoading.value = false;
    disabledClaim.value = false;
  }
};

const createWithdrawalAccount = async () => {
  console.log('create withdrawal account...');
  if (!window.mina) {
    message.error('Please install auro wallet browser extension first.');
    return;
  }

  if (withdrawNote.value?.ownerAddress !== appState.value.connectedWallet58) {
    message.error('Please connect to the wallet that is consistent with note’s ownerAddress.');
    return;
  }

  createWithdrawalAccountLoading.value = true;
  try {
    const isContractReady = await remoteSdk.isVaultContractCompiled();
    if (!isContractReady) {
      message.error('Anomix Vault contract is not ready, please try again later. If it is ready, you will receive a message notification.');
      createWithdrawalAccountLoading.value = false;
      return;
    }
    const txJson = await remoteSdk.createWithdrawalAccount(withdrawNote.value?.ownerAddress!,
      appState.value.connectedWallet58!);

    const { hash: txHash } = await window.mina.sendTransaction({
      transaction: txJson,
    });
    console.log('tx send success, txHash: ', txHash);
    checkTxUrl.value = appState.value.explorerUrl + txHash;

    await remoteApi.checkTx(txHash);
    message.success('Create withdrawal account success.');
    withdrawAccountExists.value = true;
    createWithdrawalAccountLoading.value = false;
  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
    createWithdrawalAccountLoading.value = false;
  }
};

const loadAccountInfoByConnectedWallet = async () => {
  console.log('loadAccountInfoByConnectedWallet...');

  if (appState.value.connectedWallet58 !== null) {
    const account = await remoteApi.getL1Account(appState.value.connectedWallet58!);

    console.log('account: ', account);
    const balance = convertToMinaUnit(account.balance)!.toString();
    L1TokenBalance.value = { token: 'MINA', balance };
    console.log('L1TokenBalance: ', L1TokenBalance.value);

    // check withdrawAccount if exists
    const tokenId = await remoteSdk.getWithdrawAccountTokenId();
    const withdrawAccount = await remoteApi.getL1Account(appState.value.connectedWallet58!, tokenId);
    if (withdrawAccount !== undefined) {
      withdrawAccountExists.value = true;
    } else {
      withdrawAccountExists.value = false;
    }
  }
};

const connect = async () => {
  console.log('connect wallet...');
  if (!window.mina) {
    message.error('Please install auro wallet browser extension first.');
    return;
  }

  try {
    const currentNetwork = await window.mina.requestNetwork();
    if (appState.value.minaNetwork !== currentNetwork) {
      message.error(`Please switch to the correct network (${appState.value.minaNetwork}) first.`);
      return;
    }

    let accounts = await window.mina.requestAccounts();
    if (withdrawNote.value?.ownerAddress !== accounts[0]) {
      message.error('Please connect to the wallet that is consistent with note’s ownerAddress.');
      return;
    }

    setConnectedWallet(accounts[0]);

    await loadAccountInfoByConnectedWallet();
  } catch (error: any) {
    // if user reject, requestAccounts will throw an error with code and message filed
    console.log(error.message, error.code);
    message.error(error.message);
  }
};

const disconnect = () => {
  setConnectedWallet(null);
  L1TokenBalance.value = null;
};

const walletListenerSetted = ref(false);

onMounted(async () => {
  console.log('onMounted...');

  const notes = await remoteApi.getClaimableNotes([commitment]);
  if (notes.length !== 1) {
    message.error('Note commitment is invalid', { duration: 0, closable: true });
    return;
  }
  withdrawNote.value = {
    token: 'MINA',
    ownerAddress: notes[0].ownerPk,
    balance: convertToMinaUnit(notes[0].value)!.toString(),
  };


  await loadAccountInfoByConnectedWallet();

  if (syncerListenerSetted.value === false) {
    listenSyncerChannel((e: SdkEvent) => {
      if (e.eventType === SdkEventType.VAULT_CONTRACT_COMPILED_DONE) {
        message.info('Anomix Vault Contract is ready now', { duration: 0, closable: true });
      }
    });
    syncerListenerSetted.value = true;
  }

  if (!walletListenerSetted.value) {
    if (window.mina) {
      window.mina.on('accountsChanged', (accounts: string[]) => {
        console.log('claim - connected account change: ', accounts);
        if (route.path === `/claim/${commitment}`) {
          if (accounts.length === 0) {
            message.error('Please connect your wallet', {
              closable: true,
              duration: 0
            });
            disconnect();
          } else {
            if (accounts[0] !== withdrawNote.value?.ownerAddress) {
              message.error('The owner of the claim note is inconsistent with the current wallet. Please switch to the correct wallet', {
                closable: true,
                duration: 0
              });

              return;
            }
            setConnectedWallet(accounts[0]);

          }
        }

      });

      window.mina.on('chainChanged', (chainType: string) => {
        console.log('claim - current chain: ', chainType);
        if (chainType !== appState.value.minaNetwork) {
          message.error('Please switch to Berkeley network', {
            closable: true,
            duration: 0
          });
        }
      });
    }

    walletListenerSetted.value = true;
  }

});


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
      color: var(--ano-text-primary);
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
    background: var(--ano-bg);
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
