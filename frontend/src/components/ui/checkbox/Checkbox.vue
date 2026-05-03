<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { Check } from "lucide-vue-next"
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui"
import { cn } from '@/utils/cn'

const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<CheckboxRootEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot data-slot="checkbox" v-bind="forwarded" :class="cn('peer border-input data-[state=checked]:bg-orange-400 data-[state=checked]:text-primary-foreground data-[state=checked]:border-orange-400 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-lg border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 hover:cursor-pointer',
    props.class)">
    <CheckboxIndicator data-slot="checkbox-indicator"
      class="flex items-center justify-center text-current transition-none hover:cursor-pointer">
      <slot>
        <Check class="size-3.5 hover:cursor-pointer" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
