<script setup lang="ts">
import { Button } from '@/components/ui/button';
import Card from '@/components/ui/card/Card.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import { useGameSession } from '@/composables/useGameSession';
import { useGameStore } from '@/stores/gameStore';
import { useUserStore } from '@/stores/userStore';
import type { Difficulty } from '@/stores/models/difficulty';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
const router = useRouter()
const gameStore = useGameStore()
const userStore = useUserStore()
const { resumeSavedPuzzle } = useGameSession()
const navigateToPuzzle = (difficulty: Difficulty['rating']) => {
  router.push({ name: 'sudoku', params: { difficulty: difficulty } })
}
const resumePuzzle = async () => {
  if (!userStore.currentPuzzleId) return;
  const result = await resumeSavedPuzzle(userStore.currentPuzzleId);
  if (!result.success) {
    toast.error(result.error ?? "An error occured resuming puzzle")
  } else {
    router.push({ name: 'sudoku', params: { difficulty: result.body?.difficultyRating } })
  }
}
</script>

<template>
  <main class="w-full h-full flex items-center justify-center my-20">
    <Card class="w-[85%] md:w-100">
      <CardHeader class="flex flex-col items-center justify-center">
        <CardTitle class="text-4xl">Sudoku</CardTitle>
        <CardDescription>Pick a difficulty to get started</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center justify-center">
        <Button v-if="(userStore.isAuthenticated && userStore.currentPuzzleId)" @click="resumePuzzle" class="w-52 m-1">
          <span v-if="!gameStore.loading">Resume Game</span>
          <Icon v-else icon="line-md:loading-twotone-loop" />
        </Button>
        <Button @click="navigateToPuzzle('beginner')" class="w-52 m-1">Beginner</Button>
        <Button @click="navigateToPuzzle('easy')" class="w-52 m-1">Easy</Button>
        <Button @click="navigateToPuzzle('medium')" class="w-52 m-1">Medium</Button>
        <Button disabled @click="router.push('/sudoku/hard')" class="w-52 m-1">Hard (Comming Soon!)</Button>
        <Button disabled @click="router.push('/sudoku/impossible')" class="w-52 m-1">Impossible (Comming Soon!)</Button>
      </CardContent>
    </Card>
  </main>
</template>
