<script setup lang="ts">
import { ref } from 'vue';
import { Card, CardContent } from '@/components/ui/card';
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldSet from "@/components/ui/field/FieldSet.vue";
import FieldLegend from "@/components/ui/field/FieldLegend.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import { FieldError } from '@/components/ui/field';
import Input from "@/components/ui/input/Input.vue";
import { Icon } from "@iconify/vue";
import Button from "@/components/ui/button/Button.vue";
import { useAuth } from '@/composables/useAuth';
import { z } from 'zod/mini';

const { requestEmailVerification } = useAuth();
const isLoading = ref<boolean>(false);
const error = ref<string>();
const email = ref<string>('');

async function handleRequestEmail(event: SubmitEvent) {
  event.preventDefault();
  isLoading.value = true;
  const emailResult = z.email().safeParse(email.value);
  if (!emailResult.success) {
    error.value = "Invalid email!"
    return;
  } else {
    error.value = undefined;
  }
  await requestEmailVerification(email.value)
  isLoading.value = false
}
</script>

<template>
  <main class="w-full h-full flex items-center justify-center my-20">
    <LoadingOverlay v-if="isLoading" message="Loading" />
    <div v-else>
      <div>
        <Card class="w-[85%] md:w-100">
          <CardContent>
            <form v-on:submit="handleRequestEmail">
              <FieldGroup>
                <FieldSet>
                  <FieldLegend class="w-full mb-0">Enter your email to verify</FieldLegend>
                  <Separator />
                  <FieldGroup>
                    <Field>
                      <FieldLabel for="email">Email</FieldLabel>
                      <Input id="email" v-model:model-value="email" type="text" placeholder="email@example.com"
                        autocomplete="email" :aria-invalid="error != undefined" required />
                      <FieldError :errors="[error]" />
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <Field orientation="horizontal" class="justify-end">
                  <Button class="w-20 bg-orange-400 hover:bg-orange-400" type="submit" v-if="!isLoading">Submit</Button>
                  <Button class="w-20 bg-orange-400" v-else>
                    <Icon icon="line-md:loading-twotone-loop" />
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </main>
</template>
