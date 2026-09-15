<script setup lang="ts">
import Button from "./ui/button/Button.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogClose,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
const errorMessage = defineModel<null | string>("message", { default: null });
</script>
<template>
  <Dialog :open="errorMessage !== null">
    <DialogContent>
      <DialogTitle>Oops!</DialogTitle>
      <DialogDescription>{{ errorMessage }}</DialogDescription>
      <DialogFooter>
        <DialogClose as-child>
          <Button @click="() => (errorMessage = null)">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
