<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { FieldGroup, FieldSet, FieldLegend, Field, FieldLabel, FieldError } from '../ui/field';
import Separator from '../ui/separator/Separator.vue';
import InputGroup from "../ui/input-group/InputGroup.vue";
import InputGroupInput from "../ui/input-group/InputGroupInput.vue";
import InputGroupAddon from "../ui/input-group/InputGroupAddon.vue";
import InputGroupButton from "../ui/input-group/InputGroupButton.vue";
import { Icon } from "@iconify/vue";
import Button from "../ui/button/Button.vue";
import { passwordSchema } from '@/validation/registerValidation';
import { useMousePressed } from '@vueuse/core';
import { useUserStore } from '@/stores/userStore';
import { useAuth } from '@/composables/useAuth';
import { useRoute, useRouter } from 'vue-router';
import { z } from 'zod/mini';
import { toast } from 'vue-sonner';

const router = useRouter();
const { resetPassword } = useAuth();
const route = useRoute();
const userStore = useUserStore();
const password = ref<string>('');
const passwordErrorMessage = ref<string | undefined>();

const confirmPassword = ref<string>('');
const confirmPasswordErrorMessage = ref<string | undefined>();

// for hiding/showing password input
const showPasswordRef = useTemplateRef("show-password");
const { pressed: showPassword } = useMousePressed({ target: showPasswordRef });

const showConfirmPasswordRef = useTemplateRef("show-confirm-password");
const { pressed: showConfirmPassword } = useMousePressed({
  target: showConfirmPasswordRef,
});

async function handleResetPassword(event: SubmitEvent) {
  event.preventDefault();
  const passwordRes = passwordSchema.safeParse(password.value);
  const passwordMatches = password.value === confirmPassword.value;
  const tokenRes = z.uuid().safeParse(route.query.token);
  if (!passwordRes.success) {
    passwordErrorMessage.value = "Password must contain a minimum of 8 characters, one uppercase, one lowercase, one number, and one special character";
    return;
  } else {
    passwordErrorMessage.value = undefined;
  }
  if (!passwordMatches) {
    confirmPasswordErrorMessage.value = "Does not match password field!"
    return;
  } else {
    confirmPasswordErrorMessage.value = undefined;
  }
  if (!tokenRes.success) {
    toast.error("An error occured: Missing or invalid reset token!", {
      description: "Please re-request a reset link email."
    });
    return;
  }
  const success = await resetPassword(tokenRes.data, password.value);
  if (success) {
    toast.success("Password successfully reset!", {
      description: "Please login again."
    })
    router.push({ name: "home" })
  }

}
</script>
<template>
  <form v-on:submit="handleResetPassword">
    <FieldGroup>
      <FieldSet>
        <FieldLegend class="mb-0">Reset Password</FieldLegend>
        <Separator />
        <FieldGroup>
          <Field>
            <FieldLabel for="password">New Password</FieldLabel>
            <InputGroup :aria-invalid="passwordErrorMessage !== undefined">
              <InputGroupInput id="password" v-model:model-value="password" :type="showPassword ? 'text' : 'password'"
                required />
              <InputGroupAddon align="inline-end">
                <InputGroupButton tabindex="-1" ref="show-password" type="button">
                  <Icon :icon="showPassword
                    ? 'radix-icons:eye-open'
                    : 'radix-icons:eye-closed'
                    " />
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
                <InputGroupButton tabindex="-1" ref="show-confirm-password" type="button">
                  <Icon :icon="showConfirmPassword
                    ? 'radix-icons:eye-open'
                    : 'radix-icons:eye-closed'
                    " />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError :errors="[confirmPasswordErrorMessage]" />
          </Field>
        </FieldGroup>
      </FieldSet>
      <Field orientation="horizontal" class="justify-end">
        <Button class="w-20 bg-orange-400 hover:bg-orange-400/75" type="submit"
          v-if="!userStore.loading">Submit</Button>
        <Button class="w-20 bg-orange-400" v-else>
          <Icon icon="line-md:loading-twotone-loop" />
        </Button>
      </Field>
    </FieldGroup>
  </form>
</template>
