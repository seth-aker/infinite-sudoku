<script setup lang="ts">
import { useSudokuGame } from '@/composables/useSudokuGame';
import { type Cell as ICell } from '@/stores/gameStore';
import { computed } from 'vue';
import Cell from './Cell.vue'
const { selectCell, getRow } = useSudokuGame()

const BLOCK_LEN = 3;
const GAP_PX = 3;
const CELL_SIDE = 40;
const PUZZLE_SIZE = (CELL_SIDE * 9) + ((BLOCK_LEN - 1) * GAP_PX)

const getBlockSpacing = (idx: number) => {
  const offset = (CELL_SIDE * idx) + (Math.floor(idx / BLOCK_LEN) * GAP_PX);
  return `${offset}px`
}
const rows = computed(() => {
  const arr: ICell[][] = []
  for (let i = 0; i < 9; i++) {
    arr.push(getRow(i))
  }
  return arr;
})
</script>

<template>
  <div class="relative bg-black flex items-center justify-center mb-4"
    :style="{ height: `${PUZZLE_SIZE + GAP_PX * 2}px`, width: `${PUZZLE_SIZE + GAP_PX * 2}px` }">
    <div class="relative bg-gray-500 dark:bg-background"
      :style="{ height: `${PUZZLE_SIZE}px`, width: `${PUZZLE_SIZE}px` }">
      <div v-for="(row, rowIndex) in rows" :key="`row${rowIndex}`" class="absolute w-full"
        :style="{ top: getBlockSpacing(rowIndex), height: `${CELL_SIDE}px` }">
        <div class="relative h-full w-full">
          <Cell v-for="(cell, columnIndex) in row" :key="`cell${columnIndex}`" @click="() => { selectCell(cell.idx) }"
            :style="{ left: getBlockSpacing(columnIndex) }" class="absolute" :cell="cell" :width="CELL_SIDE" />
        </div>
      </div>
    </div>
  </div>
</template>
