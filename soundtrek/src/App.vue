<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import PersistentPlayer from '@/components/PersistentPlayer.vue'
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <div id="app-main" class="app-main">
      <RouterView v-slot="{ Component }">
        <KeepAlive include="TopView">
          <component :is="Component" :key="$route.fullPath" />
        </KeepAlive>
      </RouterView>
    </div>
    <PersistentPlayer />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
</style>
