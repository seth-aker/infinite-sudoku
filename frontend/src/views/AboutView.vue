<script setup lang="ts">
import ErrorDialog from '@/components/ErrorDialog.vue';
import LoadingOverlay from '@/components/LoadingOverlay.vue';
import { onMounted, ref } from 'vue';
import Markdownit from 'markdown-it'
const readme = ref('');
const error = ref<string | undefined>(undefined)
const isLoading = ref(true);
const md = new Markdownit()
onMounted(async () => {
  const res = await fetch('/README.md')
  isLoading.value = false;
  if (res.ok) {
    const raw = await res.text()
    readme.value = md.render(raw);
  } else {
    error.value = await res.text()
  }
})

</script>

<template>
  <div
    class="flex flex-row self-center md:max-w-[75%] pb-10 pr-16 pl-16 border-r-orange-300  border-l-orange-300 border-2">
    <div class="markdown" v-html="readme"></div>
    <LoadingOverlay v-if="isLoading" />
    <ErrorDialog v-if="error" :message="error" />
  </div>
</template>

<style lang="css" scoped>
.markdown :deep(h1) {
  font-size: xx-large;
  text-decoration: underline;
  font-weight: bold;
}

.markdown :deep(h2) {
  font-size: x-large;
  text-decoration: underline;
  padding-top: 1cap;
}

.markdown :deep(ul) {
  list-style-type: disc;
  padding-left: 2rem;
}

.markdown :deep(a) {
  text-decoration: underline;
  color: var(--color-orange-400);
}

.markdown :deep(p) {
  padding-bottom: 1cap;
}
</style>
