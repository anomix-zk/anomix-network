<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
        <!-- <div class="title">Deposit</div> -->
      </div>

    </div>

    <div class="operation-title"><template v-if="currPageAction === PageAction.SEND_TOKEN">Send
        Assets</template><template v-else>Withdraw Assets</template></div>


    <div class="send-form">

      <div class="form-main">

        <div class="ano-token">

          <div class="token-icon">
            <van-icon :name="minaIcon" size="40" />
          </div>

          <div class="token-info">
            <div class="token-name">MINA</div>
            <div class="token-balance">Balance <template v-if="balanceLoading"><n-spin :size="14"
                  stroke="#97989d" /></template><template v-else>{{ totalMinaBalance }}</template> MINA</div>
          </div>

        </div>

        <div class="amount">
          <n-input-number :placeholder="currPageAction === PageAction.SEND_TOKEN ? 'Send amount' : 'Withdraw amount'"
            size="large" clearable :show-button="false" :validator="checkPositiveNumber" v-model:value="sendAmount">
            <template #suffix>
              <div class="max-btn" @click="maxInputAmount">MAX</div>
            </template>
          </n-input-number>
        </div>

        <div class="sendTo">

          <div class="label">To</div>

          <div class="to-input">
            <n-input
              :placeholder="currPageAction === PageAction.SEND_TOKEN ? 'Alias (xxx.ano) or Anomix address (B62)' : 'Mina address (B62)'"
              size="large" clearable :allow-input="checkNoSideSpace" v-model:value="receiver" @blur="checkAliasExist">
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
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";
import { SdkEvent, TxInfo } from '../../common/types';
import { PageAction, SdkEventType } from '../../common/constants';

const router = useRouter();
const { appState, showLoadingMask, closeLoadingMask, setPageParams, clearPageParams, pageParams, setTotalNanoBalance } = useStatus();
const { checkNoSideSpace, convertToMinaUnit } = useUtils();
const message = useMessage();
const { SdkState, listenSyncerChannel } = useSdk();
const remoteSdk = SdkState.remoteSdk!;
const remoteApi = SdkState.remoteApi!;
const remoteSyncer = SdkState.remoteSyncer!;

const checkPositiveNumber = (x: number) => x > 0;
const toBack = () => router.back();

const currPageAction = ref(PageAction.SEND_TOKEN);
const balanceLoading = ref(false);
const totalMinaBalance = computed(() => convertToMinaUnit(appState.value.totalNanoBalance));
// const tokenInfo = ref<{ token: string; balance: string }>({
//   token: 'MINA',
//   balance: '0.0',
// });

const maxInputAmount = () => {
  sendAmount.value = totalMinaBalance.value?.toNumber();
};

const anonToReceiver = ref(false);
const handleSwitchValue = (value: boolean) => {
  console.log('anonToReceiver-switch: ', value);
  anonToReceiver.value = value;
};

const sendAmount = ref<number | undefined>(undefined);
const receiver = ref('');
// -1: not alias, 0: alias not exist, 1: alias exist
const checkAlias = ref(-1);
const checkAliasExist = async () => {
  console.log('checkAliasExist...');
  if (!receiver.value.endsWith('.ano')) {
    checkAlias.value = -1;
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
};


const feeValue = ref<number | undefined>(undefined);
const fees = ref<{ kind: string; value: string }[]>([
  {
    kind: 'Normal',
    value: '0.03'
  },
  {
    kind: 'Faster',
    value: '0.09'
  }
]);

feeValue.value = Number(fees.value[0].value);
const maskId = 'send';
const maskListenerSetted = ref(false);

const toConfirm = async () => {
  console.log('toConfirm...');
  if (sendAmount.value === undefined || sendAmount.value <= 0) {
    message.error('Please input amount.');
    return;
  }
  if (receiver.value === '') {
    message.error('Please input receiver.');
    return;
  }

  try {
    showLoadingMask({ text: 'Waiting for circuits compling...', id: maskId, closable: false });
    const isPrivateCircuitReady = await remoteSdk.isPrivateCircuitCompiled();
    if (!isPrivateCircuitReady) {
      if (maskListenerSetted.value === false) {
        listenSyncerChannel((e: SdkEvent) => {
          if (e.eventType === SdkEventType.PRIVATE_CIRCUIT_COMPILED_DONE) {
            closeLoadingMask(maskId);
            message.info('Circuits compling done, please continue your operation', { duration: 0, closable: true });
          }
        });
        maskListenerSetted.value = true;
      }

      return;
    }

    showLoadingMask({ id: maskId, text: 'Processing...', closable: false });
    let receiverPk: string | undefined = undefined;
    let receiverAlias: string | null = null;
    if (receiver.value.endsWith('.ano')) {
      receiverAlias = receiver.value;
      receiverPk = await remoteApi.getAccountPublicKeyByAlias(receiver.value.replace('.ano', ''));
      if (!receiverPk) {
        message.error(`Receiver: ${receiver.value} not exists`, { duration: 0, closable: true });
        closeLoadingMask(maskId);
        return;
      }
    } else {
      receiverPk = receiver.value;
    }

    const params: TxInfo = {
      sender: appState.value.accountPk58!,
      senderAlias: appState.value.alias,
      receiver: receiverPk!,
      receiverAlias,
      amountOfMinaUnit: sendAmount.value.toString(),
      sendToken: 'MINA',
      feeOfMinaUnit: feeValue.value!.toString(),
      feeToken: 'MINA',
      anonToReceiver: anonToReceiver.value
    };
    setPageParams(currPageAction.value, params);

    closeLoadingMask(maskId);
    router.push("/operation/confirm");
  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
    closeLoadingMask(maskId);
  }
};


onMounted(async () => {
  console.log('onMounted...');
  currPageAction.value = pageParams.value.action!;
  console.log('currPageAction: ', currPageAction);
  clearPageParams();

  balanceLoading.value = true;
  const synced = await remoteSyncer.isAccountSynced(appState.value.accountPk58!);
  if (synced) {
    const balance = await remoteApi.getBalance(appState.value.accountPk58!);
    setTotalNanoBalance(balance.toString());
    // tokenInfo.value = {
    //   token: 'MINA',
    //   balance: balance.toString()
    // };
    balanceLoading.value = false;
  }

  const txFees = await remoteApi.getTxFees();
  fees.value = [{
    kind: 'Normal',
    value: convertToMinaUnit(txFees.normal)!.toString()
  }, {
    kind: 'Faster',
    value: convertToMinaUnit(txFees.faster)!.toString()
  }];
});

</script>

<style lang="scss" scoped>
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
