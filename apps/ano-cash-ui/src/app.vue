<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>

    </n-message-provider>
  </n-config-provider>
</template>

<script lang="ts" setup>
import { NConfigProvider, GlobalThemeOverrides } from 'naive-ui';

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

onMounted(async () => {
  console.log('App mounted');
  const { getSupportStatus } = useClientUtils();
  const support = await getSupportStatus();
  console.log('support', support);


  const { createRemoteSdk, createRemoteApi, startRemoteSyncer } = useSdk();

  // await createRemoteSdk({
  //   entryContractAddress:
  //     'B62qj6vA7ogcWaHWFCynqGYxneL3xjFcSuvfPKtEVnS7w9VpAqjnCtA',
  //   vaultContractAddress:
  //     'B62qri8P5LWArpGWS4WnhP82H3JDHEhiWGnUUA34CRqdD5DWFQoSZ6c',
  //   options: {
  //     nodeUrl: 'http://198.135.49.102',
  //     minaEndpoint: 'https://berkeley.minascan.io/graphql',
  //     debug: true,
  //   },
  // });

  await createRemoteApi({
    entryContractAddress:
      'B62qj6vA7ogcWaHWFCynqGYxneL3xjFcSuvfPKtEVnS7w9VpAqjnCtA',
    vaultContractAddress:
      'B62qri8P5LWArpGWS4WnhP82H3JDHEhiWGnUUA34CRqdD5DWFQoSZ6c',
    options: {
      nodeUrl: 'http://198.135.49.102',
      minaEndpoint: 'https://berkeley.minascan.io/graphql',
      debug: true,
    },
  });

  // await startRemoteSyncer({
  //   entryContractAddress:
  //     'B62qj6vA7ogcWaHWFCynqGYxneL3xjFcSuvfPKtEVnS7w9VpAqjnCtA',
  //   vaultContractAddress:
  //     'B62qri8P5LWArpGWS4WnhP82H3JDHEhiWGnUUA34CRqdD5DWFQoSZ6c',
  //   options: {
  //     nodeUrl: 'http://198.135.49.102',
  //     minaEndpoint: 'https://berkeley.minascan.io/graphql',
  //     debug: true,
  //   },
  // });

});
</script>
