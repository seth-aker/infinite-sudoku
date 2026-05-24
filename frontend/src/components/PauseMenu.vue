<script setup lang="ts">
import Dialog from './ui/dialog/Dialog.vue';
import DialogContent from './ui/dialog/DialogContent.vue';
import DialogTitle from './ui/dialog/DialogTitle.vue';
import Label from './ui/label/Label.vue';
import DialogFooter from './ui/dialog/DialogFooter.vue';
import DialogClose from './ui/dialog/DialogClose.vue';
import Button from './ui/button/Button.vue';
import { computed } from 'vue';
import DialogDescription from './ui/dialog/DialogDescription.vue';
import { useGameClock } from '@/composables/useGameClock';
import { useGameStore } from '@/stores/gameStore';
const clock = useGameClock()
const store = useGameStore()
let progressPercent = computed(() => {
  let count = 0;
  store.cells.forEach(cell => cell.value ? count++ : undefined)
  return Math.round((count / 81) * 100)
})

</script>
<template>
  <Dialog :open="store.state === 'paused'" @update:open="(isOpen) => !isOpen ? clock.start() : undefined">
    <DialogContent>
      <DialogTitle>Game Paused</DialogTitle>
      <DialogDescription hidden>Pause Menu</DialogDescription>
      <div class="flex flex-row">
        <Label class="pr-1">Game Time: </Label>
        <div>{{ store.formattedTime }}</div>
      </div>
      <div class="flex flex-row">
        <Label class="pr-1">Progress: </Label>
        <div>{{ progressPercent }}%</div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button @click="() => clock.start()">Resume</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
