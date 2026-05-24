<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore';
import { Button } from './ui/button';
import { useSudokuGame } from '@/composables/useSudokuGame';
const store = useGameStore()
const { toggleCandidate, placeValue } = useSudokuGame()
const inputs = [1, 2, 3, 4, 5, 6, 7, 8, 9] as number[];
const onNumberPress = (value: number) => {
  if (store.selectedIdx === undefined) return;

  if (store.usingPencil) {
    toggleCandidate(value, store.selectedIdx)
  } else {
    placeValue(value, store.selectedIdx)
  }
}

const numberInPuzzleCount = (number: number) => {
  let count = 0;
  for (const cell of store.cells) {
    if (cell.value === number) {
      count++;
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
        :disabled="numberInPuzzleCount(input) >= 9 || store.state === 'paused'" @click="onNumberPress(input)">{{ input
        }}</Button>
    </div>
  </div>
</template>
