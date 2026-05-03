<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue';
import { ref } from 'vue';
import Popover from '../ui/popover/Popover.vue';
import PopoverTrigger from '../ui/popover/PopoverTrigger.vue';
import PopoverContent from '../ui/popover/PopoverContent.vue';
import Tabs from '../ui/tabs/Tabs.vue';
import TabsList from '../ui/tabs/TabsList.vue';
import TabsTrigger from '../ui/tabs/TabsTrigger.vue';
import TabsContent from '../ui/tabs/TabsContent.vue';
import LoginForm from './LoginForm.vue';
import RegisterForm from './RegisterForm.vue';

const popoverOpen = ref<boolean>(false);

</script>

<template>
  <Popover v-model:open="popoverOpen" @update:open="(value) => popoverOpen = value">
    <PopoverTrigger as-child>
      <Button variant="ghost" class="dark:hover:bg-orange-400 hover:bg-orange-300/50">Login</Button>
    </PopoverTrigger>
    <PopoverContent class="mr-2">
      <Tabs default-value="login">
        <TabsList>
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="signup">Signup</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm :popover-open="popoverOpen" />
        </TabsContent>
        <TabsContent value="signup">
          <RegisterForm :popover-open="popoverOpen" />
        </TabsContent>
      </Tabs>
    </PopoverContent>
  </Popover>
</template>
