<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from './ui/button';
import Toggle from './ui/toggle/Toggle.vue';
import { useSudokuStore } from '@/stores/sudokuStore'
import Numpad from './Numpad.vue';
import Checkbox from './ui/checkbox/Checkbox.vue';
import { onMounted, onUnmounted } from 'vue';
import { useGameStore } from '@/stores/gameStore';
const sudokuStore = useSudokuStore()
const gameStore = useGameStore()
const eraseValue = () => {
  const { x, y } = sudokuStore.selectedCell;
  if (x === undefined || y === undefined) {
    return;
  }
  const cell = sudokuStore.getCell(x, y)
  if (!cell) {
    console.error(`Cell at ${x}, ${y} could not be found.`)
    return;
  }
  if (cell.value === undefined) {
    cell.candidates = [];
  }
  cell.value = undefined;
  sudokuStore.setCell(cell, x, y)
}


const handleCheckboxChange = (isChecked: boolean | string) => {
  if (typeof isChecked === 'string') return;
  sudokuStore.autoCandidateMode = isChecked;
  if (sudokuStore.autoCandidateMode) {
    sudokuStore.fillPuzzleCandidates();
  } else {
    sudokuStore.clearPuzzleCandidates();
  }
}
const handleKeyPress = (event: KeyboardEvent) => {
  if (sudokuStore.selectedCell.x === undefined || sudokuStore.selectedCell.y === undefined) return;
  switch (event.key) {
    case 'ArrowUp':
      if (sudokuStore.selectedCell.y === 0) {
        sudokuStore.selectedCell.y = sudokuStore.puzzle.cellsPerRow - 1;
      } else {
        sudokuStore.selectedCell.y--;
      }
      break;
    case 'ArrowDown':
      if (sudokuStore.selectedCell.y === sudokuStore.puzzle.cellsPerRow - 1) {
        sudokuStore.selectedCell.y = 0;
      } else {
        sudokuStore.selectedCell.y++;
      }
      break;
    case 'ArrowLeft':
      if (sudokuStore.selectedCell.x === 0) {
        sudokuStore.selectedCell.x = sudokuStore.puzzle.cellsPerRow - 1;
      } else {
        sudokuStore.selectedCell.x--;
      }
      break;
    case 'ArrowRight':
      if (sudokuStore.selectedCell.x === sudokuStore.puzzle.cellsPerRow - 1) {
        sudokuStore.selectedCell.x = 0;
      } else {
        sudokuStore.selectedCell.x++
      }
      break;
    case 'Backspace':
      const cell = sudokuStore.getCell(sudokuStore.selectedCell.x, sudokuStore.selectedCell.y);
      if (!cell) return;
      if (sudokuStore.usingPencil) {
        cell.candidates = [];
        cell.value = undefined
      } else {
        cell.value = undefined;
      }
      sudokuStore.setCell(cell, sudokuStore.selectedCell.x, sudokuStore.selectedCell.y)
      break;
    case 'p':
    case 'P':
      sudokuStore.usingPencil = !sudokuStore.usingPencil
      break;
    case 'z':
    case 'Z':
      if (event.ctrlKey) {
        sudokuStore.undoAction()
      }
      break;
    default:
      for (let i = 0; i < sudokuStore.puzzle.cellsPerRow; i++) {
        if (`${i + 1}` === event.key) {
          const cell = sudokuStore.getCell(sudokuStore.selectedCell.x, sudokuStore.selectedCell.y);
          if (!cell || cell.type === 'prefilled') return;
          if (sudokuStore.usingPencil) {
            cell.candidates.includes(i + 1) ? cell.candidates = cell.candidates.filter((value) => value !== i + 1) : cell.candidates.push(i + 1)
          } else {
            cell.value = cell.value === (i + 1) ? undefined : (i + 1)
          }
          sudokuStore.setCell(cell, sudokuStore.selectedCell.x, sudokuStore.selectedCell.y)
          break;
        }
      }
  }
}

onMounted(() => {
  window.addEventListener('keyup', handleKeyPress);
})
onUnmounted(() => {
  window.removeEventListener('keyup', handleKeyPress);
})
</script>

<template>
  <div class="flex flex-col items-center mx-4">
    <div class="flex gap-2 md:gap-0 w-[60%] md:w-auto justify-evenly">
      <Button :disabled="gameStore.gameState === 'paused'" @click="() => sudokuStore.undoAction()"
        class="mx-0.5 size-12 md:size-10">
        <Icon icon="material-symbols:undo-rounded" />
      </Button>
      <Button :disabled="gameStore.gameState === 'paused'" @click="eraseValue" class="mx-0.5 size-12 md:size-10">
        <Icon icon="material-symbols:ink-eraser-outline-rounded" />
      </Button>
      <Toggle :disabled="gameStore.gameState === 'paused'" variant="outline"
        @update:model-value="sudokuStore.usingPencil = !sudokuStore.usingPencil" class="mx-0.5 size-12 md:size-10 data-[state=on]:bg-orange-400/95"
        :model-value="sudokuStore.usingPencil">
        <Icon icon="material-symbols:edit-outline-rounded" />
      </Toggle>
    </div>

    <Numpad />
    <div class="flex items-center justify-center">
      <Checkbox :disabled="gameStore.gameState === 'paused'" id="auto-candidate"
        :model-value="sudokuStore.autoCandidateMode" @update:model-value="handleCheckboxChange" />
      <label for="auto-candidate" class="text-xs ml-1">
        Auto-fill candidates
      </label>
    </div>
  </div>
</template>
