<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import NavHeader from './components/NavHeader.vue';
// import { watch } from 'vue';
// import { useAuth0 } from '@auth0/auth0-vue';
// import { useUserStore } from '@/stores/userStore'
const route = useRoute();
// const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();
// const userStore = useUserStore();

// watch(user, async () => {
//   if (isAuthenticated.value) {
//     userStore.userLoading = true;
//     console.log("isAuthenticated run")
//     userStore.$patch({
//       name: user.value?.name,
//       email: user.value?.email,
//       image: user.value?.picture
//     })
//     if (userStore.id === undefined) {
//       const token = await getAccessTokenSilently()
//       await userStore.getUser(token)
//     }
//   }
//   userStore.userLoading = false;
// })

</script>

<template>
  <div class="max-w-screen flex flex-col">
    <NavHeader />
    <RouterView :key="route.fullPath" />
  </div>
</template>
