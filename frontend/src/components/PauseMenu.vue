<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore';
import Dialog from './ui/dialog/Dialog.vue';
import DialogContent from './ui/dialog/DialogContent.vue';
import DialogTitle from './ui/dialog/DialogTitle.vue';
import Label from './ui/label/Label.vue';
import { useSudokuStore } from '@/stores/sudokuStore';
import DialogFooter from './ui/dialog/DialogFooter.vue';
import DialogClose from './ui/dialog/DialogClose.vue';
import Button from './ui/button/Button.vue';
import { computed } from 'vue';
import DialogDescription from './ui/dialog/DialogDescription.vue';
const gameStore = useGameStore()
const sudokuStore = useSudokuStore();
let progressPercent = computed(() => {
  let count = 0;
  sudokuStore.puzzle.rows.forEach(row => {
    row.forEach(cell => {
      if (cell.value) {
        count++;
      }
    })
  })
  return Math.round((count / 81) * 100)
})

</script>
<template>
  <Dialog :open="gameStore.gameState === 'paused'"
    @update:open="(isOpen) => !isOpen ? gameStore.startTimer() : undefined">
    <DialogContent>
      <DialogTitle>Game Paused</DialogTitle>
      <DialogDescription hidden>Pause Menu</DialogDescription>
      <div class="flex flex-row">
        <Label class="pr-1">Game Time: </Label>
        <div>{{ gameStore.formattedElapsedTime }}</div>
      </div>
      <div class="flex flex-row">
        <Label class="pr-1">Progress: </Label>
        <div>{{ progressPercent }}%</div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button @click="() => gameStore.startTimer()">Resume</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
