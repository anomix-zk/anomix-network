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

        <div class="title"><template v-if="currPageAction === PageAction.SEND_TOKEN">Send Assets</template><template
            v-else>Withdraw Assets</template></div>

        <div class="ano-token">
          <div class="token-info">
            <van-icon :name="minaIcon" size="40" />
            <div class="token-name">{{ params?.sendToken }}</div>
          </div>
          <div class="token-balance">
            {{ params?.amountOfMinaUnit }} {{ params?.sendToken }}
          </div>
        </div>

        <div class="send">
          <div class="label">From</div>
          <div class="address-item">
            {{ params?.sender }} <span v-if="params!.senderAlias !== null" style="font-weight: 600;">({{
              params!.senderAlias + '.ano' }})</span>
          </div>
        </div>

        <div class="send">
          <div class="label">To</div>
          <div class="address-item">
            {{ params?.receiver }} <span v-if="params!.receiverAlias !== null" style="font-weight: 600;">({{
              params?.receiverAlias }})</span>
          </div>
        </div>

        <div v-if="currPageAction === PageAction.SEND_TOKEN" class="anon"><span style="font-weight: 600;">Anonymous to
            receiver:</span> {{ params.anonToReceiver ? 'Yes' :
              'No' }}</div>

      </div>


      <div class="fee-box">
        <div class="title">Tx Fee</div>

        <div class="ano-token">

          <div class="token-info">
            <van-icon :name="minaIcon" size="40" />
            <div class="token-name">MINA</div>
          </div>

          <div class="token-balance">
            {{ params?.feeOfMinaUnit }} MINA
          </div>

        </div>
      </div>

      <n-button type="info" class="form-btn" style="margin-bottom: 20px;" @click="sendTx">
        Confirm to send
      </n-button>


    </div>


  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import minaIcon from "@/assets/mina.svg";
import { PageAction } from '../../common/constants';
import { TxInfo } from '../../common/types';


const router = useRouter();
const message = useMessage();
const { pageParams, showLoadingMask, closeLoadingMask, appState, setPageParams } = useStatus();
const { convertToNanoMinaUnit } = useUtils();
const currPageAction = ref(pageParams.value.action);
const params = ref<TxInfo>(pageParams.value.params);

const { SdkState } = useSdk();
const remoteSdk = SdkState.remoteSdk!;
const remoteApi = SdkState.remoteApi!;
const maskId = 'confirm';

const toBack = () => router.back();

const sendTx = async () => {
  try {
    console.log('Prove and send tx...');
    showLoadingMask({ id: maskId, text: 'Generating Proof...', closable: false });
    console.log("tx params: ", params.value);
    const tx = await remoteSdk.createPaymentTx({
      accountPk58: params.value!.sender,
      alias: params.value!.senderAlias,
      senderAccountRequiredBool: appState.value.alias !== null,
      receiverPk58: params.value!.receiver,
      receiverAccountRequiredBool: params.value!.receiverAlias !== null,
      anonToReceiver: params.value!.anonToReceiver,
      amount: convertToNanoMinaUnit(params.value!.amountOfMinaUnit)!.toString(),
      txFeeAmount: convertToNanoMinaUnit(params.value!.feeOfMinaUnit)!.toString(),
      isWithdraw: params.value!.isWithdraw,
    });

    console.log('paymentTx json: ', tx);
    showLoadingMask({ id: maskId, text: 'Sending Tx...', closable: false });
    await remoteApi.sendTx(tx);

    message.success('Transaction sent successfully!');
    setPageParams(PageAction.ACCOUNT_PAGE, 'history');
    await navigateTo("/account", { replace: true });
    closeLoadingMask(maskId);

  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
    closeLoadingMask(maskId);
  }
};


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


    .send {
      .label {
        text-align: left;
        margin-top: 25px;
        margin-bottom: 25px;
        font-size: 20px;
        font-weight: 600;
        line-height: 20px;
      }

      .address-item {
        font-size: 15px;
        font-weight: 500;
      }
    }

    .anon {
      margin-top: 25px;
      font-size: 15px;
      font-weight: 500;
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
    color: var(--ano-primary);
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
  }

  .full-tips {
    font-size: 12px;
    line-height: 20px;
    color: var(--ano-text-third);
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
