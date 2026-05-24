<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from './ui/button';
import Toggle from './ui/toggle/Toggle.vue';
import Numpad from './Numpad.vue';
import Checkbox from './ui/checkbox/Checkbox.vue';
import { useGameStore } from '@/stores/gameStore';
import { useSudokuGame } from '@/composables/useSudokuGame';
import { useEventListener } from '@vueuse/core';
const store = useGameStore()
const { setAutoCandidateMode, selectCell, clearCell, togglePencil, undo, redo, placeValue, toggleCandidate } = useSudokuGame();

const handleCheckboxChange = (isChecked: boolean | string) => {
  if (typeof isChecked === 'string') return;
  setAutoCandidateMode(isChecked)
}
const handleKeyPress = (event: KeyboardEvent) => {
  if (store.selectedIdx === undefined) {
    return;
  }
  switch (event.key) {
    case 'ArrowUp':
      let idx = store.selectedIdx - 9;
      if (idx < 0) {
        idx = 81 + idx;
      }
      selectCell(idx)
      break;
    case 'ArrowDown':
      idx = store.selectedIdx + 9;
      if (idx > 80) {
        idx = 0 + (idx % 81)
      }
      selectCell(idx)
      break;
    case 'ArrowLeft':
      if (store.selectedIdx === 0) {
        idx = 80
      } else {
        idx = store.selectedIdx - 1
      }
      selectCell(idx)
      break;
    case 'ArrowRight':
      if (store.selectedIdx === 80) {
        idx = 0;
      } else {
        idx = store.selectedIdx + 1
      }
      selectCell(idx)
      break;
    case 'Backspace':
      clearCell(store.selectedIdx)
      break;
    case 'p':
    case 'P':
      togglePencil()
      break;
    case 'z':
    case 'Z':
      if (event.ctrlKey) {
        undo()
      }
      break;
    case 'y':
    case 'Y':
      if (event.ctrlKey) {
        redo()
      }
      break;
    default:
      const key = Number.parseInt(event.key)
      if (Number.isNaN(key)) {
        return;
      }
      if (store.usingPencil) {
        toggleCandidate(key, store.selectedIdx)
      } else {
        placeValue(key, store.selectedIdx)
      }
      break
  }
}
useEventListener('keyup', handleKeyPress)

</script>

<template>
  <div class="flex flex-col items-center mx-4">
    <div class="flex gap-2 md:gap-0 w-[60%] md:w-auto justify-evenly">
      <Button :disabled="store.state === 'paused'" @click="() => undo()" class="mx-0.5 size-12 md:size-10">
        <Icon icon="material-symbols:undo-rounded" />
      </Button>
      <Button :disabled="store.state === 'paused'" @click="() => redo()" class="mx-0.5 size-12 md:size-10">
        <Icon icon="material-symbols:redo-rounded" />
      </Button>
      <Toggle :disabled="store.state === 'paused'" variant="outline" @update:model-value="() => togglePencil()"
        class="mx-0.5 size-12 md:size-10 data-[state=on]:bg-orange-400/95" :model-value="store.usingPencil">
        <Icon icon="material-symbols:edit-outline-rounded" />
      </Toggle>
    </div>

    <Numpad />

    <div class="flex items-center justify-center">
      <Checkbox :disabled="store.state === 'paused'" id="auto-candidate" :model-value="store.autoCandidateMode"
        @update:model-value="handleCheckboxChange" />
      <label for="auto-candidate" class="text-xs ml-1">
        Auto-fill candidates
      </label>
    </div>
  </div>
</template>
