<script setup lang="ts">
import { useUserStore } from '@/stores/userStore'
import { useMousePressed } from '@vueuse/core';
import { ref, useTemplateRef } from 'vue';
import FieldGroup from '../ui/field/FieldGroup.vue'
import FieldSet from '../ui/field/FieldSet.vue'
import FieldLegend from '../ui/field/FieldLegend.vue'
import Separator from '../ui/separator/Separator.vue'
import Field from '../ui/field/Field.vue'
import FieldLabel from '../ui/field/FieldLabel.vue'
import Input from '../ui/input/Input.vue'
import InputGroup from '../ui/input-group/InputGroup.vue'
import InputGroupInput from '../ui/input-group/InputGroupInput.vue'
import InputGroupAddon from '../ui/input-group/InputGroupAddon.vue'
import InputGroupButton from '../ui/input-group/InputGroupButton.vue'
import { Icon } from '@iconify/vue'
import Button from '../ui/button/Button.vue'
import { toast } from 'vue-sonner';
const userStore = useUserStore()

const popoverOpen = defineModel<boolean>('popover-open', { required: true })

const username = ref<string>('')
const password = ref<string>('');
const showPasswordRef = useTemplateRef('show-password')
const { pressed: showPassword } = useMousePressed({ target: showPasswordRef });

const handleLogin = async (event: SubmitEvent) => {
  event.preventDefault()
  toast.promise(() =>
    Promise.all([
      userStore.login(username.value, password.value),
      new Promise((resolve) => setTimeout(resolve, 500))
    ])
    , {
      success: () => {
        if (userStore.isAuthenticated) {
          popoverOpen.value = false
          return `Welcome back, ${!userStore.displayName ? userStore.username : userStore.displayName}!`
        } else {
          return userStore.error ?? `Invalid username or password`
        }
      },
      loading: "Loading...",
      error: userStore.error ?? 'An unexpected error occured.'
    }
  )
}
</script>

<template>
  <form v-on:submit="handleLogin">
    <FieldGroup>
      <FieldSet>
        <FieldLegend class="w-full mb-0">Login</FieldLegend>
        <Separator />
        <FieldGroup>
          <Field>
            <FieldLabel for="username">Username</FieldLabel>
            <Input id="username" v-model:model-value="username" type="text" placeholder="email@example.com"
              autocomplete="username" required />
          </Field>
          <Field>
            <FieldLabel for="password">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput id="password" v-model:model-value="password" :type="showPassword ? 'text' : 'password'"
                required autocomplete="current-password" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton ref="show-password" type="button">
                  <Icon :icon="showPassword ? 'radix-icons:eye-open' : 'radix-icons:eye-closed'" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </FieldSet>
      <Field orientation="horizontal" class="justify-end">
        <Button class="w-20 bg-orange-400 hover:bg-orange-400/75" type="submit"
          v-if="!userStore.userLoading">Submit</Button>
        <Button class="w-20 bg-orange-400" v-else>
          <Icon icon="line-md:loading-twotone-loop" />
        </Button>
      </Field>
    </FieldGroup>
  </form>
</template>
