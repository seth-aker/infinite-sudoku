<script setup lang="ts">
import { useGameStore, type Cell } from '@/stores/gameStore';
import { PEERS } from '@/utils/puzzleUtils';
import { computed } from 'vue';
const { cell } = defineProps<{
  cell: Cell
  width: number,
}>();
const store = useGameStore();
const isSelected = computed(() => store.selectedIdx === cell.idx)
const isHighlighted = computed(() => store.selectedIdx ? PEERS[store.selectedIdx].includes(cell.idx) : false)
const hasError = computed(() => PEERS[cell.idx].some((peer) => store.cells[peer].value === cell.value))
const isImmutible = computed(() => store.originalCells[cell.idx].value !== 0)

const visableCandidates = computed(() => {
  const isVisableArray: boolean[] = new Array(9).fill(false);
  return isVisableArray.map((_isVisible, index) => {
    return cell.value !== 0 ? false : cell.candidates.includes(index + 1);
  })
})

</script>

<template>
  <div :class="[
    'outline-1 outline-gray-300 dark:outline-background',
    { 'bg-orange-200 dark:bg-orange-300': isHighlighted },
    { 'bg-orange-400 dark:bg-orange-400': isSelected },
    { 'bg-white dark:bg-primary': !isHighlighted && !isSelected }
  ]" :style="{ height: `${width}px`, width: `${width}px` }" class="absolute">
    <div v-if="cell.value !== 0" class="relative h-full w-full flex items-center justify-center text-black"
      :class="[{ 'font-bold': isImmutible }, { 'text-red-600': hasError }]">
      {{ cell.value }}</div>
    <div v-else class="relative h-full w-full flex flex-wrap">
      <div v-for="(isVisable, index) in visableCandidates" :style="{ width: `${100 / 3}%`, height: `${100 / 3}%` }">
        <span v-show="isVisable" class="font-light text-2xs flex items-center justify-center text-black">
          {{ index + 1 }}
        </span>
      </div>
    </div>
  </div>
</template>
