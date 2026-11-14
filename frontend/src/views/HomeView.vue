<script setup lang="ts">
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card/Card.vue";
import CardContent from "@/components/ui/card/CardContent.vue";
import CardDescription from "@/components/ui/card/CardDescription.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import { useDialog } from "@/composables/useDialog";
import { useGameSession } from "@/composables/useGameSession";
import { useGameStore, type DifficultyRating } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { Icon } from "@iconify/vue";
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
const router = useRouter();
const gameStore = useGameStore();
const userStore = useUserStore();
const { showDialog } = useDialog()
const { resumeSavedPuzzle, loadLocal, clearLocal } = useGameSession();

onMounted(() => loadLocal());

const startNewPuzzle = async (difficulty: DifficultyRating) => {
  if (hasInProgressPuzzle.value) {
    showDialog({
      title: "Overwrite current game?",
      message: "You have a current game in progress. Would you like to " +
        "overwrite your progress and start a new game?",
      buttons: [
        {
          text: "Resume saved game",
          onClick: () => {
            resumePuzzle()
          },
          closeOnClick: true,
        },
        {
          text: "New Game",
          onClick: () => {
            clearLocal();
            gameStore.$reset();
            router.push({ name: "sudoku", params: { difficulty } });
          },
          closeOnClick: true,
        }
      ]
    })
  } else {
    clearLocal();
    gameStore.$reset();
    router.push({ name: "sudoku", params: { difficulty } });
  }
};
const resumePuzzle = async () => {
  if (!userStore.currentPuzzleId && !gameStore.puzzleId) return;
  if (!userStore.currentPuzzleId && gameStore.puzzleId) {
    router.push({
      name: "sudoku",
      params: { difficulty: gameStore.difficultyRating },
    })
  }
  if (!userStore.currentPuzzleId) return;
  const result = await resumeSavedPuzzle(userStore.currentPuzzleId);
  if (!result.success) {
    toast.error(result.error ?? "An error occured resuming puzzle");
  } else {
    router.push({
      name: "sudoku",
      params: { difficulty: result.body?.difficultyRating },
    });
  }
};
const hasInProgressPuzzle = computed(() => {
  return (userStore.isAuthenticated && !!userStore.currentPuzzleId) ||
    (!!gameStore.puzzleId && !gameStore.isSolved);
})
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
        <Button @click="startNewPuzzle('beginner')" class="w-52 m-1">Beginner</Button>
        <Button @click="startNewPuzzle('easy')" class="w-52 m-1">Easy</Button>
        <Button @click="startNewPuzzle('medium')" class="w-52 m-1">Medium</Button>
        <Button @click="startNewPuzzle('hard')" class="w-52 m-1">Hard</Button>
      </CardContent>
    </Card>
  </main>
</template>
