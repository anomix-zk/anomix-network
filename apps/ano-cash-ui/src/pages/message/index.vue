<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />
        <!-- <div class="title">Deposit</div> -->
      </div>

    </div>

    <div class="operation-title">Notification</div>



    <div v-for="item in messages" class="message-item">

      <div class="content">
        <div class="action"> {{ item.action }} </div>
        <div class="change-balance">{{ item.value }} {{ item.token }}</div>
      </div>

      <div class="txHash">
        <div class="label">TX HASH</div>
        {{ item.txHash }}
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


const messages = [
  {
    action: 'DEPOSIT',
    token: 'MINA',
    value: 10.3,
    txHash: 'wegwegwegwegwegwg',
  },
  {
    action: 'DEPOSIT',
    token: 'MINA',
    value: 201,
    txHash: 'wegwegwegwegwegwg',
  },
  {
    action: 'CLAIM',
    token: 'MINA',
    value: 12.245,
    txHash: 'wegwegwegwegwegwg',
  },
];



const toBack = () => router.back();
</script>

<style lang="scss" scoped>
.message-item {
  margin-top: 10px;
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 12px;
  padding-bottom: 12px;
  background: var(--up-bg);
  // border-width: 0.5px;
  // border-style: dotted;
  // border-color: #000;

  //transition: background-color .3s cubic-bezier(.4, 0, .2, 1);
  // background-color: rgba(237, 245, 254, 1);

  // border: 1px solid rgba(199, 223, 251, 1);
  // transition: border-color .3s var(--n-bezier);

  border-radius: 12px;
  flex-direction: column;

  color: var(--up-text-primary);
  //font-weight: 500;
  //font-size: 16px;
  align-items: center;
  flex-shrink: 0;
  //line-height: 24px;

  .content {
    padding-top: 5px;
    padding-bottom: 5px;
    font-size: 13px;

    display: flex;
    justify-content: space-between;

    .action {
      color: gray;
      font-weight: 600;
    }

    .change-balance {
      text-align: left;
      color: #000;
      //font-weight: 580;
    }
  }

  .txHash {
    padding-top: 5px;
    padding-bottom: 5px;
    display: flex;
    font-size: 13px;
    //font-weight: 580;
    justify-content: space-between;
    color: gray;

    .label {
      color: gray;
      font-weight: 600;
    }

    .content {
      color: #000;
    }

  }

}

.operation-title {
  text-align: left;
  margin-top: 32px;
  font-size: 20px;
  font-weight: 600;
  line-height: 20px;
  margin-bottom: 25px;
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
