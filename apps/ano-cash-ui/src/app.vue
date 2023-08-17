<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <NuxtPage />
    </n-message-provider>
  </n-config-provider>
</template>

<script lang="ts" setup>
import { NConfigProvider, GlobalThemeOverrides } from 'naive-ui'

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
  }
};

onMounted(() => {
  console.log('app vue mounted');
});
</script>
