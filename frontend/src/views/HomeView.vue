<script setup lang="ts">
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card/Card.vue";
import CardContent from "@/components/ui/card/CardContent.vue";
import CardDescription from "@/components/ui/card/CardDescription.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import { useGameSession } from "@/composables/useGameSession";
import { usePuzzleNavigation } from "@/composables/usePuzzleNavigation";
import { useGameStore } from "@/stores/gameStore";
import { Icon } from "@iconify/vue";
import { onMounted } from "vue";
const gameStore = useGameStore();
const { loadLocal, hasInProgressPuzzle } = useGameSession();
const {chooseNewPuzzle, resumePuzzle} = usePuzzleNavigation()
onMounted(() => loadLocal());

</script>

<template>
  <main class="w-full h-full flex items-center justify-center my-20">
    <Card class="w-[85%] md:w-100">
      <CardHeader class="flex flex-col items-center justify-center">
        <CardTitle class="text-4xl text-orange-400">Infinite Sudoku</CardTitle>
        <CardDescription>Pick a difficulty to get started</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center justify-center">
        <Button v-if="hasInProgressPuzzle" @click="resumePuzzle" class="w-52 m-1">
          <span v-if="!gameStore.loading">Resume Game</span>
          <Icon v-else icon="line-md:loading-twotone-loop" />
        </Button>
        <Button @click="chooseNewPuzzle('beginner')" class="w-52 m-1">Beginner</Button>
        <Button @click="chooseNewPuzzle('easy')" class="w-52 m-1">Easy</Button>
        <Button @click="chooseNewPuzzle('medium')" class="w-52 m-1">Medium</Button>
        <Button @click="chooseNewPuzzle('hard')" class="w-52 m-1">Hard</Button>
      </CardContent>
    </Card>
  </main>
</template>
