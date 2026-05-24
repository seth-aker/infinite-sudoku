<script setup lang="ts">
import { useDialog, type DialogButton } from '@/composables/useDialog';
import Button from './ui/button/Button.vue';
import Dialog from './ui/dialog/Dialog.vue';
import DialogContent from './ui/dialog/DialogContent.vue';
import DialogDescription from './ui/dialog/DialogDescription.vue';
import DialogFooter from './ui/dialog/DialogFooter.vue';
import DialogHeader from './ui/dialog/DialogHeader.vue';
import DialogTitle from './ui/dialog/DialogTitle.vue';

const { isOpen, dialogState, closeDialog } = useDialog()

async function handleBtnClick(btn: DialogButton) {
  if (btn.onClick) {
    await btn.onClick()
  }
  if (btn.closeOnClick) {
    closeDialog()
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent v-if="dialogState">
      <DialogHeader>
        <DialogTitle>{{ dialogState.title }}</DialogTitle>
        <DialogDescription>{{ dialogState.message }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button v-for="(btn, idx) in dialogState.buttons" :key="idx" :variant="btn.variant || 'default'"
          @click="handleBtnClick(btn)">{{ btn.text }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
