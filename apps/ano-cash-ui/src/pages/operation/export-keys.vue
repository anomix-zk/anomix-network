<template>
  <div style="justify-content: flex-start;">
    <div class="ano-header">
      <div class="left" @click="toBack">
        <van-icon name="arrow-left" size="24" />

      </div>

    </div>

    <div class="operation-title">Export Keys</div>


    <div class="export-form">

      <template v-if="!showKeys">

        <div class="account">
          <div class="left" />
          <div class="right">
            <div class="alias">{{ alias }}</div>
            <div class="address">{{ accountPk58 }}</div>

          </div>
        </div>

        <div class="form-item" style="margin-top: 10px;">
          <div v-show="showPwdTitle" class="placeholder">{{ placeholderPwd }}
          </div>
          <n-input v-model:value="pwd" class="item" clearable type="password" show-password-on="click" size="large"
            :placeholder="placeholderPwd" :maxlength="30" @blur="blurPwd" @input="inputPwd" />
        </div>

        <n-button type="info" class="form-btn" style="margin-top: 40px; margin-bottom: 20px;" @click="exportKeys">
          Export
        </n-button>

      </template>

      <template v-else>
        <div class="key-name">Account Key (Used to decrypt Notes)</div>

        <div class="key-box">
          {{ accountKey }}
        </div>

        <div class="btn-box" style="padding-bottom: 15px;">
          <div class="btn-item">
            <n-button color="#f4f4f4" block type="primary" @click="copyKey(accountKey)" class="copy-btn">
              <div style="display:flex; align-items: center;">
                <span style="color:#1f202a">Copy To Clipboard</span>
              </div>
            </n-button>
          </div>
        </div>


        <div class="key-name" style="margin-top: 45px;">Account Signing Key {{ accountSigningKey2 !== '' ? '1' : '' }}
          (Used to spend Notes)</div>

        <div class="key-box">
          {{ accountSigningKey1 }}
        </div>

        <div class="btn-box" style="padding-bottom: 15px;">
          <div class="btn-item">
            <n-button color="#f4f4f4" block type="primary" @click="copyKey(accountSigningKey1)" class="copy-btn">
              <div style="display:flex; align-items: center;">
                <span style="color:#1f202a">Copy To Clipboard</span>
              </div>
            </n-button>
          </div>
        </div>

        <template v-if="accountSigningKey2 !== ''">
          <div class="key-name" style="margin-top: 45px;">Account Signing Key 2 (Used to spend Notes)</div>

          <div class="key-box">
            {{ accountSigningKey2 }}
          </div>

          <div class="btn-box" style="padding-bottom: 15px;">
            <div class="btn-item">
              <n-button color="#f4f4f4" block type="primary" @click="copyKey(accountSigningKey2)" class="copy-btn">
                <div style="display:flex; align-items: center;">
                  <span style="color:#1f202a">Copy To Clipboard</span>
                </div>
              </n-button>
            </div>
          </div>
        </template>

      </template>

    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';

const message = useMessage();
const { appState } = useStatus();
const { omitAddress } = useUtils();
const { SdkState } = useSdk();
const router = useRouter();

const remoteApi = SdkState.remoteApi!;
let copyFunc: (text: string) => void;
let timer: NodeJS.Timeout | null = null;

const showKeys = ref(false);
const alias = computed(() => appState.value.alias !== null ? appState.value.alias + '.ano' : null);
const accountPk58 = computed(() => omitAddress(appState.value.accountPk58));
const accountKey = ref("");
const accountSigningKey1 = ref("");
const accountSigningKey2 = ref("");

const pwd = ref("");
const placeholderPwd = ref("Password");
const showPwdTitle = ref(false);
const blurPwd = () => {
  if (pwd.value.length === 0) {
    showPwdTitle.value = false;
  }
};
const inputPwd = () => {
  if (!showPwdTitle.value) {
    showPwdTitle.value = true;
  }
};


const toBack = () => {
  router.back();
  showKeys.value = false;
  accountKey.value = "";
  accountSigningKey1.value = "";
  accountSigningKey2.value = "";
  clearInterval(timer!);
  removeUserOperationListenr();
  console.log("to back success");
};

const copyKey = (key: string) => {
  copyFunc(key);
  message.success("Copied to clipboard");
};

const maskId = "exportKeys";

const exportKeys = async () => {
  const pwdTrim = pwd.value.trim();
  if (pwdTrim.length === 0) {
    message.error('Please input password');
    return;
  }

  try {
    const accountPrivateKey58 = await remoteApi.getSercetKey(appState.value.accountPk58!, pwdTrim);
    if (!accountPrivateKey58) {
      message.error('Password wrong');
      return;
    }
    accountKey.value = accountPrivateKey58;

    const sks = await remoteApi.getSigningKeys(appState.value.accountPk58!);
    if (sks.length === 0) {
      throw new Error('Account Signing Key not found');
    }

    if (sks.length >= 2) {
      const sk1 = await remoteApi.getSercetKey(sks[0].signingPk, pwdTrim);
      accountSigningKey1.value = sk1!;

      const sk2 = await remoteApi.getSercetKey(sks[1].signingPk, pwdTrim);
      accountSigningKey2.value = sk2!;
    } else {
      const sk1 = await remoteApi.getSercetKey(sks[0].signingPk, pwdTrim);
      accountSigningKey1.value = sk1!;
    }

    showKeys.value = true;
  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 3000, closable: true });
  }
};


const inactivityTime = ref(0);
const maxInactivityTime = ref(2 * 60); // 2 minutes inactivity
const resetTimer = () => {
  inactivityTime.value = 0;
};
const checkInactivity = () => {
  inactivityTime.value = inactivityTime.value + 1;

  if (inactivityTime.value > maxInactivityTime.value && showKeys.value) {
    message.info("The keys export page has been closed due to inactivity for 2 minutes", { duration: 0, closable: true });
    toBack();
  }
};
const addUserOperationListener = () => {
  document.addEventListener("mousemove", resetTimer);
  document.addEventListener("keydown", resetTimer);
  document.addEventListener("click", resetTimer);
  document.addEventListener("scroll", resetTimer);
};
const removeUserOperationListenr = () => {
  document.removeEventListener("mousemove", resetTimer);
  document.removeEventListener("keydown", resetTimer);
  document.removeEventListener("click", resetTimer);
  document.removeEventListener("scroll", resetTimer);
};

onMounted(() => {
  console.log("export-keys onMounted...");
  try {
    const { copyText } = useClientUtils();
    copyFunc = copyText;

    addUserOperationListener();
    timer = setInterval(checkInactivity, 1000);
  } catch (err: any) {
    console.error(err);
    message.error(err.message, { duration: 0, closable: true });
  }
});

</script>

<style lang="scss" scoped>
.account {
  margin-top: 15px;
  padding: 15px;
  background: var(--ano-bg);
  border-radius: 12px;
  margin-bottom: 40px;
  color: var(--ano-text-primary);
  display: flex;

  .left {
    border-radius: 50%;
    width: 40px;
    height: 40px;
    background: #fff;
    border: 1px solid #fff;
    margin-right: 10px;
    background-image: url(@/assets/anomix.svg);
    background-size: cover;
  }

  .right {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;

    .alias {
      font-size: 16px;
      font-weight: 600;
      line-height: 16px;
    }

    .address {
      display: flex;
      align-items: center;
      cursor: pointer;
      margin-top: 8px;
      font-size: 14px;
      line-height: 14px;
      font-weight: 400;
      color: var(--ano-text-third);

    }
  }

}


.form-item {
  position: relative;

  .item {
    background: var(--ano-bg-checked);
  }

  .placeholder {
    position: absolute;
    left: 16px;
    top: -8px;
    height: 16px;
    font-size: 16px;
    font-weight: 400;
    line-height: 16px;
    color: #606266;
    z-index: 999;
  }

}


.btn-box {
  margin-top: 20px;
  width: 100%;

  .btn-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 55px;
    border-radius: 12px;

    background-color: var(--ano-bg-checked);
    transition: all .15s;
    box-shadow: inset 1px 1px 3px var(--ano-line);

    span {
      margin-left: 10px;
      font-weight: 600;
      font-size: 15px;
      line-height: 24px;
    }

    .copy-btn {
      display: flex;
      flex-wrap: nowrap;
      justify-content: center;
      align-items: center;
      align-content: center;
      height: 100%;
      border-radius: 12px;
    }
  }

  .btn-item+.btn-item {
    margin-top: 20px;
  }
}

.export-form {
  margin-top: 35px;

  .key-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .key-box {
    margin-top: 20px;
    padding: 20px;
    // background: var(--ano-bg);
    border-radius: 12px;
    border-width: 1px;
    border-color: black;
    border-style: solid;

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
