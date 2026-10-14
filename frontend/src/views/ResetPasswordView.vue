<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Card, CardContent } from '@/components/ui/card';
import PasswordResetForm from '@/components/loginRegister/PasswordResetForm.vue';
const router = useRouter();
const isLoading = ref<boolean>(false);
const error = ref<string>();
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
        <Card class="w-[85%] md:w-100">
          <CardContent>
            <PasswordResetForm />
          </CardContent>
        </Card>
      </div>
    </div>
  </main>
</template>
