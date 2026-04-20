<script setup lang="ts">
import { useSudokuStore } from '@/stores/sudokuStore';
import { Button } from './ui/button';
import { useGameStore } from '@/stores/gameStore';
const sudokuStore = useSudokuStore();
const gameStore = useGameStore()
const inputs = [] as number[];
for (let i = sudokuStore.puzzle.cellsPerRow; i > 0; i--) {
  inputs.push(i);
}
const onNumberPress = (value: number) => {
  const { x, y } = sudokuStore.selectedCell
  const cell = sudokuStore.getCell(x, y);
  if (x === undefined || y === undefined || cell === undefined || cell.type === 'prefilled') {
    return;
  }
  if (sudokuStore.usingPencil) {
    // Edit pencilValues
    if (cell.candidates.includes(value)) {
      cell.candidates = cell.candidates.filter((pencilValue) => pencilValue !== value);
    } else {
      cell.candidates.push(value);
    }
  } else {
    // edit cell value
    if (cell.value === undefined || cell.value !== value) {
      cell.value = value;
    } else {
      cell.value = undefined;
    }
  }
  cell.type = 'edited'
  sudokuStore.setCell(cell, x, y)
}

const numberInPuzzleCount = (number: number) => {
  let count = 0;
  for (const row of sudokuStore.puzzle.rows) {
    if (count >= sudokuStore.puzzle.cellsPerRow) {
      break;
    }
    for (const cell of row) {
      if (cell.value === number) {
        count++
        break;
      }
    }
  }
  return count;
}
</script>

<template>
  <div class="mx-4 my-2 w-full justify-center flex">
    <div class="grid gap-1 place-items-center w-[60%] md:w-auto"
      :style="{ gridTemplateColumns: `repeat(3, minmax(0, 1fr))` }">
      <Button class="size-12 aspect-square md:size-10" v-for="(input) in inputs"
        :disabled="numberInPuzzleCount(input) === sudokuStore.puzzle.cellsPerRow || gameStore.gameState === 'paused'"
        @click="onNumberPress(input)">{{ input
        }}</Button>
    </div>
  </div>
</template>
