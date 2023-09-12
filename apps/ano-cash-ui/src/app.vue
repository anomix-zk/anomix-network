<template>
  <n-config-provider :theme-overrides="themeOverrides" v-if="supportStatus === 'supported'">
    <n-dialog-provider>
      <n-message-provider>
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>

  <div v-else
    style="display:flex;justify-content:center;align-items:center;height:100vh;font-size: 20px;font-weight: 600;">
    Your device or browser is not supported, reason: {{ supportStatus }}
  </div>
</template>

<script lang="ts" setup>
import { NConfigProvider, GlobalThemeOverrides } from 'naive-ui';
import { CHANNEL_SYNCER } from './common/constants';

const { createRemoteSdk, createRemoteApi, startRemoteSyncer } = useSdk();
const runtimeConfig = useRuntimeConfig();
const { setTokenPrices, showLoadingMask, closeLoadingMask } = useStatus();

const themeOverrides: GlobalThemeOverrides = {
  Input: {
    // borderHover: '0.5px solid rgb(224,224,230)',
    // borderFocus: '0.5px solid rgb(224,224,230)',
    // boxShadowFocus: '0 0 0 2px rgb(224,224,230)'
    borderHover: '0.5px solid #e5e5e5',
    borderFocus: '0.5px solid #e5e5e5',
    boxShadowFocus: '0 0 0 0.5px #e5e5e5',
    heightLarge: '56px',
    borderRadius: '12px',
  },
  Tabs: {
    tabTextColorActiveLine: '#4098fc',
    tabTextColorHoverLine: '#4098fc',
    tabTextColorActiveBar: '#4098fc',
    tabTextColorHoverBar: '#4098fc',
    barColor: '#4098fc'
  },
  Switch: {
    railColorActive: '#4098fc',
    loadingColor: '#4098fc',
  },
  Spin: {
    fontSize: '20px',
    textColor: '#fff',
    color: '#fff',
    sizeLarge: '46px',
  }
};

const supportStatus = ref("supported");

const maskId = 'appInit';

onMounted(async () => {
  console.log('App mounted...');
  showLoadingMask({ text: 'App Initializing...', id: maskId, closable: false });

  try {
    const { getSupportStatus } = useClientUtils();
    const support = await getSupportStatus();
    console.log('support status:', support);
    supportStatus.value = support;

    console.log('runtimeConfig: ', runtimeConfig.public);

    if (supportStatus.value !== 'supported') {
      return;
    }

    const debug = runtimeConfig.public.debug as boolean;
    const entryContractAddress = runtimeConfig.public.entryContractAddress as string;
    const vaultContractAddress = runtimeConfig.public.vaultContractAddress as string;
    const nodeUrl = runtimeConfig.public.nodeUrl as string;
    const minaEndpoint = runtimeConfig.public.minaEndpoint as string;
    const nodeRequestTimeoutMS = runtimeConfig.public.nodeRequestTimeoutMS as number;
    const l2BlockPollingIntervalMS = runtimeConfig.public.l2BlockPollingIntervalMS as number;
    const broadcastChannelName = CHANNEL_SYNCER;

    await createRemoteSdk({
      entryContractAddress,
      vaultContractAddress,
      options: {
        nodeUrl,
        minaEndpoint,
        nodeRequestTimeoutMS,
        l2BlockPollingIntervalMS,
        broadcastChannelName,
        debug,
      },
    });

    await createRemoteApi({
      entryContractAddress,
      vaultContractAddress,
      options: {
        nodeUrl,
        minaEndpoint,
        nodeRequestTimeoutMS,
        l2BlockPollingIntervalMS,
        broadcastChannelName,
        debug,
      },
    });

    await startRemoteSyncer({
      entryContractAddress,
      vaultContractAddress,
      options: {
        nodeUrl,
        minaEndpoint,
        nodeRequestTimeoutMS,
        l2BlockPollingIntervalMS,
        broadcastChannelName,
        debug,
      },
    });

    closeLoadingMask(maskId);

    const { data } = await useFetch('https://api.coingecko.com/api/v3/simple/price?ids=mina-protocol&vs_currencies=usd%2Ccny');
    const price = data.value as any;
    console.log('get price info: ', price);

    setTokenPrices([{ tokenName: 'MINA', usd: price['mina-protocol']['usd'] + '', cny: price['mina-protocol']['cny'] + '' }]);
  } catch (err: any) {
    console.error(err);
    closeLoadingMask(maskId);
  }
});
</script>
