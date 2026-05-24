<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import NavHeader from './components/NavHeader.vue';
import { onMounted } from 'vue';
import { Toaster } from './components/ui/sonner';
import 'vue-sonner/style.css'
import AppDialog from './components/AppDialog.vue';
import { useAuth } from './composables/useAuth';

const route = useRoute();
const { getSession } = useAuth()

onMounted(() => {
  getSession()
  document.documentElement.style.touchAction = 'manipulation';
})
</script>

<template>
  <div class="max-w-screen flex flex-col h-full">
    <NavHeader />
    <RouterView :key="route.fullPath" />
    <Toaster position="top-center" :toast-options="{
      style: {
        boxShadow: '0 0 10px var(--color-orange-400)'
      }
    }" />
    <AppDialog />
  </div>
</template>
