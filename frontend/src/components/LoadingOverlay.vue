<script setup lang="ts">
import { Icon } from "@iconify/vue";
</script>

<template>
  <div
    class="absolute top-0 left-0 opacity-40 bg-black h-screen w-screen z-10"
  />
  <div
    class="absolute top-0 left-0 h-screen w-screen flex items-center justify-center z-20"
  >
    <div
      class="w-70 h-30 bg-background border border-primary flex items-center justify-center"
    >
      Loading Puzzles
      <Icon class="ml-4" icon="line-md:loading-loop" />
    </div>
  </div>
</template>
