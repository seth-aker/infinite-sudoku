<script setup lang="ts">
import { ref } from 'vue';
import Button from '../ui/button/Button.vue';
import Drawer from '../ui/drawer/Drawer.vue';
import DrawerTrigger from '../ui/drawer/DrawerTrigger.vue';
import DrawerContent from '../ui/drawer/DrawerContent.vue';
import Tabs from '../ui/tabs/Tabs.vue';
import TabsList from '../ui/tabs/TabsList.vue';
import TabsTrigger from '../ui/tabs/TabsTrigger.vue';
import TabsContent from '../ui/tabs/TabsContent.vue';
import LoginForm from './LoginForm.vue';
import RegisterForm from './RegisterForm.vue';
import DrawerDescription from '../ui/drawer/DrawerDescription.vue';

const drawerOpen = ref<boolean>(false);

</script>

<template>
  <Drawer v-model:open="drawerOpen" @update:open="(val) => drawerOpen = val">
    <DrawerTrigger as-child>
      <Button variant="ghost">Login</Button>
    </DrawerTrigger>
    <DrawerContent class="px-8">
      <DrawerDescription hidden>Login or Signup</DrawerDescription>
      <Tabs class="my-8" default-value="login">
        <TabsList>
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="signup">Signup</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm :popover-open="drawerOpen" />
        </TabsContent>
        <TabsContent value="signup">
          <RegisterForm :popover-open="drawerOpen" />
        </TabsContent>
      </Tabs>
    </DrawerContent>
  </Drawer>
</template>
