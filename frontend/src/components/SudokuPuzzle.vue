<script setup lang="ts">
import Cell from './Cell.vue';
import { SudokuPuzzle } from '@/stores/models/puzzle';
import { cellHasError } from '@/utils/cellHasError';
const { puzzle } = defineProps<{
  puzzle: SudokuPuzzle,
}>();

const selectedCell = defineModel<{
  x: number | undefined, y: number | undefined
}>('selectedCell', {
  default: {
    x: undefined,
    y: undefined,
  }, required: true
})

const blockLength = Math.sqrt(puzzle?.cellsPerRow ?? 0)
const blockGapPx = 3;
const cellHeightWidth = 40;
const puzzleHeightWidth = (cellHeightWidth * puzzle?.cellsPerRow!) + ((blockLength - 1) * blockGapPx)

const generateBlockSpacingOffset = (columnIndex: number) => {
  const offset = (cellHeightWidth * columnIndex) + (Math.floor(columnIndex / blockLength) * blockGapPx);
  return `${offset}px`
}
const isCellSelected = (columnIndex: number, rowIndex: number) => {
  if (selectedCell.value?.x === undefined || selectedCell.value?.y === undefined) {
    return false;
  } else {
    return selectedCell.value?.x === columnIndex && selectedCell.value?.y === rowIndex
  }
}
const isCellHighlighted = (columnIndex: number, rowIndex: number) => {
  if (selectedCell.value?.x === undefined || selectedCell.value?.y === undefined) {
    return false;
  } else {
    return isCellInRow(rowIndex, selectedCell.value.y) || isCellInColumn(columnIndex, selectedCell.value.x) || isCellInBlock(columnIndex, rowIndex)
  }
}
const isCellInRow = (rowIndex: number, cellY: number | undefined) => {
  if (cellY === undefined) {
    return false;
  } else {
    return cellY === rowIndex
  }
}
const isCellInColumn = (columnIndex: number, cellX: number | undefined) => {
  if (cellX === undefined) {
    return false;
  } else {
    return cellX === columnIndex
  }
}
const isCellInBlock = (columnIndex: number, rowIndex: number) => {
  if (selectedCell.value?.x === undefined || selectedCell.value?.y === undefined) {
    return false;
  } else {
    const blockX = Math.floor(selectedCell.value?.x / blockLength)
    const blockY = Math.floor(selectedCell.value?.y / blockLength)
    const cellBlockX = Math.floor(columnIndex / blockLength)
    const cellBlockY = Math.floor(rowIndex / blockLength)
    return blockX === cellBlockX && blockY === cellBlockY
  }
}
</script>

<template>
  <div class="relative bg-black flex items-center justify-center mb-4"
    :style="{ height: `${puzzleHeightWidth + blockGapPx * 2}px`, width: `${puzzleHeightWidth + blockGapPx * 2}px` }">
    <div class="relative bg-gray-500" :style="{ height: `${puzzleHeightWidth}px`, width: `${puzzleHeightWidth}px` }">
      <div v-for="(row, rowIndex) in puzzle?.rows" :key="`row${rowIndex}`" class="absolute w-full"
        :style="{ top: generateBlockSpacingOffset(rowIndex), height: `${cellHeightWidth}px` }">
        <div class="relative h-full w-full">
          <Cell v-for="(cell, columnIndex) in row" :key="`cell${columnIndex}`"
            @click="() => { selectedCell.x = columnIndex; selectedCell.y = rowIndex }"
            :style="{ left: generateBlockSpacingOffset(columnIndex) }" class="absolute" :cell="cell"
            :width="cellHeightWidth" :highlighted="isCellHighlighted(columnIndex, rowIndex)"
            :selected="isCellSelected(columnIndex, rowIndex)"
            :has-error="cellHasError(puzzle, columnIndex, rowIndex)" />
        </div>
      </div>
    </div>
  </div>
</template>
