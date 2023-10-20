<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
      </div>

    </div>

    <div class="operation-title"><template v-if="currPageAction === PageAction.SEND_TOKEN">Send
        Assets</template><template v-else>Withdraw Assets</template></div>


    <div class="send-form">

      <div class="form-main">

        <div class="ano-token">

          <div class="token">
            <div class="token-icon">
              <van-icon :name="minaIcon" size="40" />
            </div>

            <div class="token-info">
              <div class="token-name">MINA</div>
              <div class="token-balance">Balance <template v-if="balanceLoading"><n-spin :size="14"
                    stroke="#97989d" /></template><template v-else>{{ totalMinaBalance }}</template> </div>
            </div>

          </div>



          <template v-if="notesInfo !== null">
            <div class="note-info">

              <div> avail notes: {{ notesInfo.availableNotesNum }}</div>

              <div> avail value: {{
                convertToMinaUnit(notesInfo.maxSpendValuePerTx) }} </div>

            </div>
          </template>

        </div>

        <div class="amount">
          <n-input-number :placeholder="currPageAction === PageAction.SEND_TOKEN ? 'Send amount' : 'Withdraw amount'"
            size="large" clearable :show-button="false" :validator="checkPositiveNumber" v-model:value="sendAmount">
            <template #suffix>
              <div class="max-btn" @click="maxInputAmount">Max</div>
            </template>
          </n-input-number>
        </div>

        <div class="sendTo">

          <div class="label">To</div>

          <div class="to-input">
            <n-input
              :placeholder="currPageAction === PageAction.SEND_TOKEN ? 'Alias (xxx.ano) or Anomix address (B62)' : 'Mina address (B62)'"
              size="large" clearable :allow-input="checkNoSideSpace" v-model:value="receiver" @input="handleInput">
              <template #suffix>
                <van-icon v-show="checkAlias === 1" name="passed" color="green" size="20" />
                <van-icon v-show="checkAlias === 0" name="close" color="red" size="20" />
              </template>
            </n-input>
          </div>

          <div v-if="currPageAction === PageAction.SEND_TOKEN" class="option">
            <div class="option-label">Anonymous to receiver</div>

            <n-switch :round="false" :checked-value="true" :unchecked-value="false" @update:value="handleSwitchValue">
              <template #checked>
                Yes
              </template>
              <template #unchecked>
                No
              </template>
            </n-switch>
          </div>


        </div>

      </div>

      <n-alert v-if="currPageAction === PageAction.WITHDRAW_TOKEN" title="Withdraw Notice" type="info"
        style="margin-top: 12px;">
        After the withdrawal transaction is processed and finalized (verified by the smart contract), you need to actively
        claim the funds before they will arrive at your mina address.
      </n-alert>

      <div class="fee-box">
        <div class="title">Tx Fee</div>

        <div v-for="fee in fees" class="radio-item">
          <div class="left">{{ fee.kind }}</div>

          <div class="right">
            <div class="price">{{ fee.value }} MINA</div>
            <n-radio name="fee" @change="handleFeeChange" :checked="feeValue === fee.value" :key="fee.kind"
              :value="fee.value" size="large" />
          </div>

        </div>

      </div>

      <n-button type="info" class="form-btn" style="margin-bottom: 20px;" @click="toConfirm">
        Next Step
      </n-button>


      <template v-if="currPageAction === PageAction.WITHDRAW_TOKEN">
        <div class="or-box">
          <div class="line"></div>
          <span>OR CLAIM WITHDRAWABLE ASSETS</span>
          <div class="line"></div>
        </div>

        <div class="oauth-box" style="margin-top: 30px; padding-bottom: 15px;">
          <div class="auth-item">
            <n-button color="#f4f4f4" block type="primary" @click="connectToClaim" class="auth-btn">
              <div style="display:flex; align-items: center;">
                <img :src="claimImage" alt="" style="width: 35px; height: 35px;" />
                <span style="color:#1f202a">Claim Assets</span>
              </div>
            </n-button>
          </div>
        </div>
      </template>


    </div>


  </div>
</template>

<script lang="ts" setup>
import claimImage from "@/assets/claim.svg";
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";
import { SdkEvent, TxInfo } from '../../common/types';
import { PageAction, SdkEventType } from '../../common/constants';

const router = useRouter();
const { appState, showLoadingMask, closeLoadingMask, setPageParams, setStartCompilePrivateCircuit,
  setConnectedWallet, pageParams, setTotalNanoBalance } = useStatus();
const { checkNoSideSpace, convertToMinaUnit } = useUtils();
const message = useMessage();
const { SdkState, listenSyncerChannel } = useSdk();
const remoteApi = SdkState.remoteApi!;
const remoteSyncer = SdkState.remoteSyncer!;
const remoteSdk = SdkState.remoteSdk!;

let syncerChannel: BroadcastChannel | null = null;
const checkPositiveNumber = (x: number) => x > 0;
const toBack = () => {
  syncerChannel?.close();
  router.back();
};

const currPageAction = ref(pageParams.value.action);
const balanceLoading = ref(false);
const totalMinaBalance = computed(() => convertToMinaUnit(appState.value.totalNanoBalance));

const anonToReceiver = ref(false);
const handleSwitchValue = (value: boolean) => {
  console.log('anonToReceiver-switch: ', value);
  anonToReceiver.value = value;
};

const sendAmount = ref<number | undefined>(undefined);
const receiver = ref('');

const maxInputAmount = () => {
  sendAmount.value = convertToMinaUnit(notesInfo.value?.maxSpendValuePerTx)?.toNumber()!;
};

const connectToClaim = async () => {
  if (!window.mina) {
    message.error('Please install auro wallet browser extension first.');
    return;
  }

  try {
    showLoadingMask({ id: maskId, text: 'Connecting wallet...', closable: false });
    const currentNetwork = await window.mina.requestNetwork();
    if (appState.value.minaNetwork !== currentNetwork) {
      closeLoadingMask(maskId);
      message.error(`Please switch to the correct network (${appState.value.minaNetwork}) first.`);
      return;
    }

    let accounts = await window.mina.requestAccounts();
    setConnectedWallet(accounts[0]);

    await navigateTo("/claim/claimable");
    closeLoadingMask(maskId);
  } catch (error: any) {
    // if user reject, requestAccounts will throw an error with code and message filed
    console.error(error);
    message.error(error.message);
    closeLoadingMask(maskId);
  }
};

// -1: not alias, 0: alias not exist, 1: alias exist
const checkAlias = ref(-1);
const handleInput = async (v: string) => {
  if (checkAlias.value !== -1) {
    checkAlias.value = -1;
  }

  console.log('checkAliasExist...');
  const receiverValue = receiver.value.trim();

  if (currPageAction.value === PageAction.WITHDRAW_TOKEN) {
    if (receiverValue.length === 0 || !receiverValue.startsWith('B62')) {
      checkAlias.value = 0;
      return;
    }
  }

  if (!receiverValue.endsWith('.ano')) {
    if (receiver.value.startsWith('B62')) {
      if (checkAlias.value !== -1) {
        checkAlias.value = -1;
      }

    } else {
      checkAlias.value = 0;
    }
    return;
  }

  const isRegistered = await remoteApi.isAliasRegistered(receiverValue.replace('.ano', ''), false);
  if (isRegistered) {
    console.log(`${receiverValue} exists`);
    checkAlias.value = 1;
  } else {
    console.log(`${receiverValue} not exists`);
    checkAlias.value = 0;
    message.error(`${receiverValue} not exists`, { closable: true });
  }
};

const feeValue = ref<number | undefined>(undefined);
const fees = ref<{ kind: string; value: number }[]>([
  {
    kind: 'Normal',
    value: 0.001
  },
  {
    kind: 'Faster',
    value: 0.09
  }
]);

feeValue.value = Number(fees.value[0].value);

const handleFeeChange = (e: Event) => {
  feeValue.value = Number((e.target as HTMLInputElement).value);
};

const maskId = 'send';

const toConfirm = async () => {
  console.log('toConfirm...');
  if (sendAmount.value === undefined || sendAmount.value <= 0) {
    message.error('Please input amount.');
    return;
  }
  if (sendAmount.value > totalMinaBalance.value!.toNumber()) {
    message.error('Insufficient balance.');
    return;
  }
  const availvalue = convertToMinaUnit(notesInfo.value?.maxSpendValuePerTx)?.toNumber()!;
  if (sendAmount.value > availvalue) {
    message.error(`A single transaction can cost up to two notes, and the sending amount exceeds the total amount of the two notes with the largest amount: ${availvalue} MINA.`);
    message.info('You can automatically merge your multiple notes by transferring the maximum available amount to yourself. Each transfer can only merge two notes.', { duration: 0, closable: true });
    return;
  }
  const receiverValue = receiver.value.trim();
  if (receiverValue.length === 0) {
    message.error('Please input receiver.');
    return;
  }
  if (checkAlias.value === 0) {
    message.error(`${receiver.value} not exists, please input a valid address or alias.`, { duration: 5000, closable: true });
    return;
  }

  try {
    showLoadingMask({ id: maskId, text: 'Processing...', closable: false });
    let receiverPk: string | undefined = undefined;
    let receiverAlias: string | null = null;
    if (receiverValue.endsWith('.ano')) {
      receiverAlias = receiverValue;
      receiverPk = await remoteApi.getAccountPublicKeyByAlias(receiverAlias.replace('.ano', ''));
      if (!receiverPk) {
        message.error(`Receiver: ${receiverAlias} not exists`, { duration: 3000, closable: true });
        closeLoadingMask(maskId);
        return;
      }
    } else {
      receiverPk = receiverValue;
    }

    const params: TxInfo = {
      sender: appState.value.accountPk58!,
      senderAlias: appState.value.alias,
      receiver: receiverPk!,
      receiverAlias,
      amountOfMinaUnit: sendAmount.value!.toString(),
      sendToken: 'MINA',
      feeOfMinaUnit: feeValue.value!.toString(),
      feeToken: 'MINA',
      anonToReceiver: anonToReceiver.value,
      isWithdraw: currPageAction.value === PageAction.WITHDRAW_TOKEN,
    };
    setPageParams(currPageAction.value, params);

    syncerChannel?.close();
    await navigateTo("/operation/confirm");
    closeLoadingMask(maskId);
  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
    closeLoadingMask(maskId);
  }
};


const notesInfo = ref<{ availableNotesNum: number; pendingNotesNum: number; maxSpendValuePerTx: string } | null>(null);
const syncerListenerSetted = ref(false);


onMounted(async () => {
  console.log('send onMounted...');
  console.log('currPageAction: ', currPageAction.value);

  showLoadingMask({ id: maskId, text: 'Loading...', closable: false });
  try {
    balanceLoading.value = true;
    const synced = await remoteSyncer.isAccountSynced(appState.value.accountPk58!);
    if (synced) {
      const balance = await remoteApi.getBalance(appState.value.accountPk58!);
      setTotalNanoBalance(balance.toString());
      balanceLoading.value = false;
    }

    const txFees = await remoteApi.getTxFees();
    fees.value = [{
      kind: 'Normal',
      value: convertToMinaUnit(txFees.normal)!.toNumber()
    }, {
      kind: 'Faster',
      value: convertToMinaUnit(txFees.faster)!.toNumber()
    }];
    feeValue.value = Number(fees.value[0].value);
    console.log('feeValue: ', feeValue.value);

    if (!syncerListenerSetted.value) {
      syncerChannel = listenSyncerChannel(async (event: SdkEvent, chan: BroadcastChannel) => {
        console.log('send - syncer event: ', event);

        if (event.eventType === SdkEventType.UPDATED_ACCOUNT_STATE) {
          if (event.data.accountPk === appState.value.accountPk58) {
            console.log('send - account state updated, reload note analysis info');

            // reload note analysis info
            const analysisInfo = await remoteApi.getAnalysisOfNotes(appState.value.accountPk58!);
            console.log('send - analysisInfo: ', analysisInfo);
            notesInfo.value = analysisInfo;

            // get latest balance
            const balance = await remoteApi.getBalance(appState.value.accountPk58!);
            setTotalNanoBalance(balance.toString());
          }
        }
      }, 'NoteAnalysisInfoListener');
      syncerListenerSetted.value = true;
    } else {
      console.log('send - syncer listener already setted');
    }

    const analysisInfo = await remoteApi.getAnalysisOfNotes(appState.value.accountPk58!);
    console.log('analysisInfo: ', analysisInfo);
    notesInfo.value = analysisInfo;


    if (!appState.value.startCompilePrivateCircuit) {
      console.log('PrivateCircuit not found to start compilation, will start soon');
      setStartCompilePrivateCircuit(true);
      remoteSdk.compilePrivateCircuit();
    } else {
      console.log('PrivateCircuit is already being compiled, no need to recompile')
    }
  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
  }

  closeLoadingMask(maskId);
});

</script>

<style lang="scss" scoped>
.oauth-box {
  margin-top: 20px;
  width: 100%;

  .auth-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    border-radius: 12px;

    background-color: var(--ano-bg-checked);
    transition: all .15s;
    box-shadow: inset 1px 1px 3px var(--ano-line);

    span {
      margin-left: 10px;
      font-weight: 600;
      font-size: 16px;
      line-height: 24px;
    }

    .auth-btn {
      display: flex;
      flex-wrap: nowrap;
      justify-content: center;
      align-items: center;
      align-content: center;
      height: 100%;
      border-radius: 12px;
    }
  }

  .auth-item+.auth-item {
    margin-top: 20px;
  }
}

.or-box {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  align-items: center;

  .line {
    width: 60px;
    height: 1px;
    background-color: var(--ano-text-third);
  }

  span {
    margin: 0 10px;
    font-size: 12px;
    font-weight: 400;
  }
}

.fee-box {
  margin-top: 20px;
  padding: 20px;
  background: var(--ano-bg);
  border-radius: 12px;
  margin-bottom: 40px;
  color: var(--ano-text-primary);

  .title {
    color: var(--ano-text-primary);
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
    background-color: var(--ano-background);

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
    border-bottom-color: var(--ano-border);
  }
}

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
      justify-content: space-between;
      flex-shrink: 0;
      flex-wrap: wrap;

      .token {
        display: flex;
        flex-wrap: wrap;

        .token-icon {
          position: relative;
          height: 40px;
          width: 40px;
        }

        .token-info {
          text-align: left;
          margin-left: 18px;
          flex-wrap: wrap;
          //min-width: 30%;

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

      .note-info {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        color: var(--ano-text-third);
        text-align: left;
        margin-left: 2px;
      }

    }

    .amount {
      margin-top: 20px;

      .max-btn {
        border-left-width: 0.5px;
        border-left-style: dotted;
        border-left-color: var(--ano-border);
        margin-left: 5px;
        padding-left: 14px;
        padding-right: 6px;
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
        margin-top: 20px;
        margin-bottom: 20px;
        font-size: 20px;
        font-weight: 600;
        line-height: 20px;
      }

      // .to-input {
      //   margin-top: 32px;
      // }

      .option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 15px;

        .option-label {
          font-weight: 600;
          font-size: 15px;
        }
      }
    }


  }



  .form-btn {
    width: 100%;
    height: 52px;
    border-radius: 12px;
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
