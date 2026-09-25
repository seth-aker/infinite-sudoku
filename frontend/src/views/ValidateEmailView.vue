<script setup lang="ts">
import { emailValidationTokenSchema } from '@/validation/routeValidation';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/ui/button/Button.vue';
import * as userService from "@/services/userService"
import LoadingOverlay from '@/components/LoadingOverlay.vue';
const router = useRouter();
const route = useRoute();
const isLoading = ref(false);
const error = ref<string | undefined>();
onMounted(async () => {
  isLoading.value = true;
  const result = await emailValidationTokenSchema.safeParseAsync(route.query.token)
  if (!result.success || !result.data) {
    error.value = result.error?.message;
    isLoading.value = false;
    return;
  }
  const validationRes = await userService.validateEmail(result.data);
  if (!validationRes.success) {
    error.value = validationRes.error
    isLoading.value = false;
    return;
  }
  error.value = undefined;
  isLoading.value = false;
  return;
})
</script>
<template>
  <main class="w-full h-full flex items-center justify-center my-20">
    <LoadingOverlay v-if="isLoading" message="Loading" />
    <div v-else>
      <div v-if="error" class="flex items-center justify-center flex-col">
        <h1 class="font-bold text-2xl p-2">Oops! An error occured.</h1>
        {{ error }}
        <Button class="m-6" @click="router.push({ name: 'home' })">Go home</Button>
      </div>
      <div v-else>
        <h1>
          Email Verified!
        </h1>
        <p>
          Feel free to close this tab and return to the app.
        </p>
      </div>
    </div>
  </main>
</template>
