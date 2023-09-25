<template>
  <div v-if="showTxDialog" class="ano-mask">
    <div class="ano-dialog" style="width:70%; height: 40%;">
      <div class="dialog-container">
        <div class="header">
          <div class="title">Submitted</div>

          <div class="close" @click="closeTxDialog">
            <van-icon name="close" color="#97989d" size="20" />
          </div>
        </div>

        <div class="content">

          <div>Approximately 3 minutes</div>
          <a :href='txExplorerUrl' target='_blank' class='processing-tx-hash'>
            <span style="color:#000;margin-right: 8px;font-weight: 500;">View Tx: </span> {{ omitTxHash
            }} >
          </a>

        </div>

        <div class="bottom">
          <div class="processing">
            <div v-if="dialogLoading" class="loading">
              <n-spin stroke="#22c493" size="small" />
              <span style="margin-left: 8px;">Processing...</span>
            </div>
            <div v-else class="loading">
              <van-icon name="passed" color="#22c493" size="28" />
              <span style="margin-left: 8px;">Done</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>

  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
        <!-- <div class="title">Deposit</div> -->
      </div>
    </div>

    <div class="operation-title">Deposit Funds</div>

    <div v-if="connectedWallet !== null" class="connected-wallet">
      <div style="display: flex; align-items: center;">
        <img :src="auroLogo" alt="" style="width: 25px; height: 25px;" />
        <span style="color:black; padding-left: 10px; font-size: 16px;">{{ connectedWallet }}</span>
      </div>

      <van-icon name="cross" size="20" @click="disconnect" />
    </div>


    <div class="send-form">

      <div class="form-main">

        <div class="ano-token">

          <div class="token-icon">
            <van-icon :name="minaIcon" size="40" />
          </div>

          <div class="token-info">
            <div class="token-name">{{
              L1TokenBalance?.token }}</div>
            <div class="token-balance">Balance <template v-if="balanceLoading"><n-spin :size="14"
                  stroke="#97989d" /></template><template v-else>{{ L1TokenBalance?.balance }}</template> {{
                    L1TokenBalance?.token }}</div>
          </div>

        </div>

        <div class="amount">
          <n-input-number placeholder="Deposit amount" size="large" clearable :show-button="false"
            :validator="checkPositiveNumber" v-model:value="depositAmount">
            <template #suffix>
              <div class="max-btn" @click="maxInputAmount">MAX</div>
            </template>
          </n-input-number>
        </div>

        <div class="sendTo">

          <div class="label">To</div>

          <div class="to-input">
            <n-input placeholder="Alias (xxx.ano) or Anomix address (B62)" size="large" clearable
              :allow-input="checkNoSideSpace" v-model:value="receiver" @blur="checkAliasExist" @input="handleInput">
              <template #suffix>
                <van-icon v-show="checkAlias === 1" name="passed" color="green" size="20" />
                <van-icon v-show="checkAlias === 0" name="close" color="red" size="20" />
              </template>
            </n-input>
          </div>

        </div>

      </div>

      <n-button v-if="connectedWallet !== null" type="info" class="form-btn" style="margin-bottom: 20px;"
        @click="deposit">
        Deposit
      </n-button>

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
const { appState, setConnectedWallet, showLoadingMask, closeLoadingMask } = useStatus();
const { omitAddress, checkNoSideSpace, convertToMinaUnit, convertToNanoMinaUnit } = useUtils();
const message = useMessage();
const { SdkState, listenSyncerChannel } = useSdk();
const remoteApi = SdkState.remoteApi!;
const remoteSdk = SdkState.remoteSdk!;

const showTxDialog = ref(false);
const dialogLoading = ref(true);
const submittedTxHash = ref('');
const omitTxHash = computed(() => omitAddress(submittedTxHash.value, 6));
const txExplorerUrl = computed(() => appState.value.explorerUrl + submittedTxHash.value);
const closeTxDialog = () => {
  showTxDialog.value = false;
};
const openTxDialog = (txHash: string) => {
  submittedTxHash.value = txHash;
  dialogLoading.value = true;
  showTxDialog.value = true;
};
const txDialogLoadingDone = () => {
  dialogLoading.value = false;
}


const connectedWallet = computed(() => omitAddress(appState.value.connectedWallet58));
const L1TokenBalance = ref<{ token: string; balance: string }>({
  token: 'MINA',
  balance: '0.0',
});
const balanceLoading = ref(false);

const disconnect = () => {
  setConnectedWallet(null);
  L1TokenBalance.value = { token: 'MINA', balance: '0' };
};

const loadConnectedWalletStatus = async () => {
  console.log('loadConnectedWalletStatus...');
  if (appState.value.connectedWallet58 !== null) {
    try {
      balanceLoading.value = true;
      const account = await remoteApi.getL1Account(appState.value.connectedWallet58!);
      if (account !== undefined) {
        const balance = convertToMinaUnit(account.balance)!.toString();
        L1TokenBalance.value = { token: 'MINA', balance };
      } else {
        L1TokenBalance.value = { token: 'MINA', balance: '0' };
      }
      balanceLoading.value = false;

    } catch (err: any) {
      console.error(err);
      message.error(err.message);
    }
  }
};

const walletListenerSetted = ref(false);

const route = useRoute();
onMounted(async () => {
  console.log('deposit page onMounted...');
  await loadConnectedWalletStatus();

  if (!walletListenerSetted.value) {
    if (window.mina) {
      window.mina.on('accountsChanged', async (accounts: string[]) => {
        console.log('deposit.vue - connected account change: ', accounts);
        if (route.path === '/operation/deposit') {
          if (accounts.length === 0) {
            message.error('Please connect your wallet', {
              closable: true,
              duration: 0
            });
            disconnect();
          } else {
            setConnectedWallet(accounts[0]);
            await loadConnectedWalletStatus();
          }
        }

      });

      window.mina.on('chainChanged', (chainType: string) => {
        console.log('deposit.vue - current chain: ', chainType);
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

const toBack = () => router.back();
const checkPositiveNumber = (x: number) => x > 0;

const depositAmount = ref<number | undefined>(undefined);
const receiver = ref('');
const maskId = 'deposit';
const maskListenerSetted = ref(false);

// -1: not alias, 0: alias not exist, 1: alias exist
const checkAlias = ref(-1);
const handleInput = (v: string) => {
  if (checkAlias.value !== -1) {
    checkAlias.value = -1;
  }
};
const checkAliasExist = async () => {
  console.log('checkAliasExist...');
  showLoadingMask({ id: maskId, text: 'Checking if input valid...', closable: false });
  if (!receiver.value.endsWith('.ano')) {
    if (receiver.value.startsWith('B62')) {
      if (checkAlias.value !== -1) {
        checkAlias.value = -1;
      }

    } else {
      checkAlias.value = 0;
      message.error(`Please input anomix address or alias.`, { duration: 5000, closable: true });
    }
    closeLoadingMask(maskId);
    return;
  }

  const isRegistered = await remoteApi.isAliasRegistered(receiver.value, false);
  if (isRegistered) {
    console.log(`${receiver.value} exists`);
    checkAlias.value = 1;
  } else {
    console.log(`${receiver.value} not exists`);
    checkAlias.value = 0;
    message.error(`${receiver.value} not exists`, { duration: 5000, closable: true });
  }
  closeLoadingMask(maskId);
};

const deposit = async () => {
  if (depositAmount.value === undefined || depositAmount.value <= 0) {
    message.error('Please input deposit amount.');
    return;
  }
  if (receiver.value === '') {
    message.error('Please input receiver.');
    return;
  }
  if (checkAlias.value === 0) {
    message.error(`${receiver.value} not exists, please input a valid address or alias.`, { duration: 5000, closable: true });
    return;
  }
  try {
    showLoadingMask({ text: 'Waiting for circuits compling...', id: maskId, closable: true });
    const isContractReady = await remoteSdk.isEntryContractCompiled();
    if (!isContractReady) {
      if (maskListenerSetted.value === false) {
        listenSyncerChannel((e: SdkEvent) => {
          if (e.eventType === SdkEventType.ENTRY_CONTRACT_COMPILED_DONE) {
            closeLoadingMask(maskId);
            message.info('Circuits compling done, please continue your deposit', { duration: 0, closable: true });
          }
        });
        maskListenerSetted.value = true;
      }

      return;
    }

    showLoadingMask({ id: maskId, text: 'Generating proof...', closable: false });
    let receiverPk: string | undefined = undefined;
    if (receiver.value.endsWith('.ano')) {
      receiverPk = await remoteApi.getAccountPublicKeyByAlias(receiver.value.replace('.ano', ''));
      if (receiverPk === undefined) {
        closeLoadingMask(maskId);
        message.error(`Receiver: ${receiver.value} not found.`, { duration: 0, closable: true });
        return;
      }
    } else {
      receiverPk = receiver.value;
    }

    const depositAmountNano = convertToNanoMinaUnit(depositAmount.value)!.toString();

    console.log('connectedWallet58: ', appState.value.connectedWallet58);
    if (appState.value.connectedWallet58 === null) {
      closeLoadingMask(maskId);
      message.error('Please connect wallet first.', { duration: 0, closable: true });
      return;
    }
    const txJson = await remoteSdk.createDepositTx({
      payerAddress: appState.value.connectedWallet58!,
      receiverAddress: receiverPk!,
      feePayerAddress: appState.value.connectedWallet58!,
      amount: depositAmountNano,
      anonymousToReceiver: false,
    });
    console.log('deposit txJson: ', txJson);

    showLoadingMask({ id: maskId, text: 'Wait for sending transaction...', closable: false });
    const { hash: txHash } = await window.mina.sendTransaction({
      transaction: txJson,
    });
    console.log('tx send success, txHash: ', txHash);
    closeLoadingMask(maskId);

    openTxDialog(txHash);
    await remoteApi.checkTx(txHash);
    txDialogLoadingDone();

    message.success('Deposit success! You can view the deposit transaction just sent in auro wallet, Ano.Cash will be updated in a few minutes.', { duration: 0, closable: true });

  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
    closeLoadingMask(maskId);
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
    setConnectedWallet(accounts[0]);

    balanceLoading.value = true;
    const account = await remoteApi.getL1Account(appState.value.connectedWallet58!);
    if (account !== undefined) {
      const balance = convertToMinaUnit(account.balance)!.toString();
      L1TokenBalance.value = { token: 'MINA', balance };
    } else {
      L1TokenBalance.value = { token: 'MINA', balance: '0' };
    }
    balanceLoading.value = false;

  } catch (err: any) {
    // if user reject, requestAccounts will throw an error with code and message filed
    console.error(err);
    message.error(err.message);
  }
};



const maxInputAmount = () => {
  depositAmount.value = Number(L1TokenBalance.value?.balance);
};


</script>

<style lang="scss" scoped>
.send-form {

  .form-main {
    margin-top: 20px;
    padding: 20px;
    background: var(--ano-bg);
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
          color: var(--ano-text-third);
          line-height: 20px;
        }
      }

    }

    .amount {
      margin-top: 20px;

      .max-btn {
        border-left-width: 0.1px;
        border-left-style: dotted;
        border-left-color: var(--ano-border);
        padding-left: 14px;
        padding-right: 6px;
        margin-left: 5px;
        font-size: 14px;
        font-weight: 500;
      }

      .max-btn:hover {
        color: var(--ano-primary);
      }
    }

    .sendTo {
      .label {
        text-align: left;
        margin-top: 32px;
        font-size: 20px;
        font-weight: 600;
        line-height: 20px;
      }

      .to-input {
        margin-top: 32px;
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
