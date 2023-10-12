<template>
  <n-config-provider :theme-overrides="themeOverrides" v-if="supportStatus === 'supported'">
    <n-dialog-provider>
      <n-notification-provider :max="1">
        <n-message-provider>
          <NuxtLayout>
            <NuxtPage />
          </NuxtLayout>
        </n-message-provider>
      </n-notification-provider>
    </n-dialog-provider>
  </n-config-provider>

  <div v-else
    style="display:flex;justify-content:center;align-items:center;height:100vh;font-size: 20px;font-weight: 600;">
    Your device or browser is not supported, reason: {{ supportStatus }}
  </div>
</template>

<script lang="ts" setup>
import { NConfigProvider, GlobalThemeOverrides } from 'naive-ui';
import { CHANNEL_SYNCER, CHANNEL_MINA, WalletEventType } from './common/constants';
import type { WalletEvent } from './common/types';

const { createRemoteSdk, createRemoteApi, startRemoteSyncer, SdkState } = useSdk();
const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const { setTokenPrices, showLoadingMask, closeLoadingMask, setMinaNetwork, appState } = useStatus();

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
const walletListenerSetted = ref(false);

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

    setMinaNetwork(runtimeConfig.public.minaNetwork as string);
    const debug = runtimeConfig.public.debug as boolean;
    const entryContractAddress = runtimeConfig.public.entryContractAddress as string;
    const vaultContractAddress = runtimeConfig.public.vaultContractAddress as string;
    const nodeUrl = runtimeConfig.public.nodeUrl as string;
    const minaEndpoint = runtimeConfig.public.minaEndpoint as string;
    const nodeRequestTimeoutMS = runtimeConfig.public.nodeRequestTimeoutMS as number;
    const l2BlockPollingIntervalMS = runtimeConfig.public.l2BlockPollingIntervalMS as number;
    const broadcastChannelName = CHANNEL_SYNCER;

    if (!appState.value.apiExist) {
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
    }

    const accounts = await SdkState.remoteApi!.getLocalAccounts();
    if (accounts.length > 0) {
      if (
        route.path === "/" ||
        route.path === "/account" ||
        route.path === "/operation/confirm" ||
        route.path === "/operation/send"
      ) {
        console.log('Exist accounts, navigate to /login/session');
        await navigateTo("/login/session");
      }
    } else {
      if (route.path === "/account" ||
        route.path === "/operation/confirm" ||
        route.path === "/operation/send" ||
        route.path === "/login/session"
      ) {
        console.log('No exist accounts, navigate to /');
        await navigateTo("/");
      }
    }

    if (!appState.value.sdkExist) {
      console.log('App mounted-start remote sdk');
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
    }

    if (!appState.value.syncerStarted) {
      console.log('App mounted-start remote syncer');
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
    }

    if (!walletListenerSetted.value) {
      if (window.mina) {
        const chan = new BroadcastChannel(CHANNEL_MINA);
        window.mina.on('accountsChanged', (accounts: string[]) => {
          console.log('App - connected account change: ', accounts);

          if (accounts.length === 0) {
            chan.postMessage({
              eventType: WalletEventType.ACCOUNTS_CHANGED,
              connectedAddress: undefined,
            } as WalletEvent);
          } else {
            chan.postMessage({
              eventType: WalletEventType.ACCOUNTS_CHANGED,
              connectedAddress: accounts[0],
            } as WalletEvent);
          }

        });

        window.mina.on('chainChanged', (chainType: string) => {
          console.log('App - current chain: ', chainType);
          if (chainType !== appState.value.minaNetwork && chainType !== 'Unknown') {
            chan.postMessage({
              eventType: WalletEventType.NETWORK_INCORRECT,
            } as WalletEvent);
          }
        });
      }

      walletListenerSetted.value = true;
    }

    const { data } = await useFetch('https://api.coingecko.com/api/v3/simple/price?ids=mina-protocol&vs_currencies=usd%2Ccny');
    const price = data.value as any;
    console.log('get price info: ', price);

    setTokenPrices([{ tokenName: 'MINA', usd: price['mina-protocol']['usd'] + '', cny: price['mina-protocol']['cny'] + '' }]);

  } catch (err: any) {
    console.error(err);
  }

  closeLoadingMask(maskId);
  console.log('App mounted end');
});
</script>
