<script setup lang="ts">
import { useUserStore } from '@/stores/userStore'
import { useMousePressed, watchDebounced } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
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
import { passwordSchema, usernameSchema } from '@/validation/registerValidation'
import FieldError from '../ui/field/FieldError.vue'
import { toast } from 'vue-sonner'
const popoverOpen = defineModel<boolean>('popover-open', { required: true })
const userStore = useUserStore()

const name = ref<string>('')
const username = ref<string>('');
const usernameErrorMessage = ref<string | undefined>(undefined);
const password = ref<string>('');
const passwordErrorMessage = ref<string | undefined>(undefined);
const confirmPassword = ref<string>('');
const confirmPasswordErrorMessage = ref<string | undefined>(undefined)

watchDebounced(username,
  (value) => {
    const res = usernameSchema.safeParse(value);
    if (!res.success) {
      usernameErrorMessage.value = "Username too short! Must be 4 or more characters"
    } else {
      usernameErrorMessage.value = undefined
    }
  },
  { debounce: 1000 }
)
watchDebounced(password,
  (value) => {
    const res = passwordSchema.safeParse(value)
    if (!res.success) {
      passwordErrorMessage.value = "Password must contain a minimum of 8 characters, one uppercase, one lowercase, one number, and one special character"
    } else {
      passwordErrorMessage.value = undefined
    }
  },
  { debounce: 1000 }
)

watchDebounced(confirmPassword,
  (value) => {
    if (value !== password.value) {
      confirmPasswordErrorMessage.value = "Password does not match!"
    } else {
      confirmPasswordErrorMessage.value = undefined
    }
  },
  { debounce: 500 }
)

const handleRegister = async (event: SubmitEvent) => {
  event.preventDefault()
  const userNameRes = usernameSchema.safeParse(username.value)
  const passwordRes = passwordSchema.safeParse(password.value)
  const confirmMatches = password.value === confirmPassword.value
  if (!userNameRes.success || !passwordRes.success || !confirmMatches) {
    return;
  }
  toast.promise(
    Promise.all([
      userStore.register(username.value, password.value, name.value),
      new Promise((resolve) => setTimeout(resolve, 500))
    ])
  ),
  {
    loading: 'Loading...',
    success: () => {
      if (userStore.error) {
        return 'Oops! An error occured during registration. Please try again.'
      }
      popoverOpen.value = false
      return `Welcome ${!name.value ? username.value : name.value}! Time to play!`
    },
    error: 'Oops! An error occured during registration. Please try again.'
  }
}

// for hiding/showing password input
const showPasswordRef = useTemplateRef('show-password')
const { pressed: showPassword } = useMousePressed({ target: showPasswordRef });

const showConfirmPasswordRef = useTemplateRef('show-confirm-password')
const { pressed: showConfirmPassword } = useMousePressed({ target: showConfirmPasswordRef })
</script>

<template>

  <form v-on:submit="handleRegister">
    <FieldGroup>
      <FieldSet>
        <FieldLegend class="mb-0">Signup</FieldLegend>
        <Separator />
        <FieldGroup>
          <Field>
            <FieldLabel for="name">Display Name</FieldLabel>
            <Input id="name" v-model:model-value="name" autocomplete="name" type="text" placeholder="Susan Doku" />
          </Field>
          <Field>
            <FieldLabel for="email">Username</FieldLabel>
            <Input :aria-invalid="usernameErrorMessage !== undefined" id="email" v-model:model-value="username"
              type="text" placeholder="email@example.com" autocomplete="username" required />
            <FieldError :errors="[usernameErrorMessage]"></FieldError>
          </Field>
          <Field>
            <FieldLabel for="password">Password</FieldLabel>
            <InputGroup :aria-invalid="passwordErrorMessage !== undefined">
              <InputGroupInput id="password" v-model:model-value="password" :type="showPassword ? 'text' : 'password'"
                required />
              <InputGroupAddon align="inline-end">
                <InputGroupButton ref="show-password" type="button">
                  <Icon :icon="showPassword ? 'radix-icons:eye-open' : 'radix-icons:eye-closed'" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError :errors="[passwordErrorMessage]" />
          </Field>
          <Field>
            <FieldLabel for="confirm-password">Confirm Password</FieldLabel>
            <InputGroup>
              <InputGroupInput id="confirm-password" v-model:model-value="confirmPassword"
                :aria-invalid="confirmPasswordErrorMessage !== undefined"
                :type="showConfirmPassword ? 'text' : 'password'" required />
              <InputGroupAddon align="inline-end">
                <InputGroupButton ref="show-confirm-password" type="button">
                  <Icon :icon="showConfirmPassword ? 'radix-icons:eye-open' : 'radix-icons:eye-closed'" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError :errors="[confirmPasswordErrorMessage]" />
          </Field>
        </FieldGroup>
      </FieldSet>
      <Field orientation="horizontal" class="justify-end">
        <Button type="submit" v-if="!userStore.userLoading"
          :disabled="usernameErrorMessage || passwordErrorMessage || confirmPasswordErrorMessage"
          class="w-30 bg-orange-400 hover:bg-orange-400/60">Create
          Account</Button>
        <Button class="w-30 bg-orange-400" v-else>
          <Icon icon="line-md:loading-twotone-loop" />
        </Button>
      </Field>
    </FieldGroup>
  </form>
</template>
