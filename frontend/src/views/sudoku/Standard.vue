<script setup lang='ts'>
import SudokuControls from '@/components/SudokuControls.vue';
import ControlInstructions from '@/components/ControlInstructions.vue';
import SudokuPuzzle from '@/components/SudokuPuzzle.vue';
import { Dialog } from '@/components/ui/dialog';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue';
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue';
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue';
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue';
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue';
import Button from '@/components/ui/button/Button.vue';
import DialogClose from '@/components/ui/dialog/DialogClose.vue';
import { Icon } from '@iconify/vue';
import LoadingOverlay from '@/components/LoadingOverlay.vue';
import ErrorDialog from '@/components/ErrorDialog.vue';
import PauseMenu from '@/components/PauseMenu.vue';
import { watchDebounced } from '@vueuse/core';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { PUZZLE_DIFFICULTY_ROUTES } from '@/router';
import { toast } from 'vue-sonner';
import { useGameStore, type DifficultyRating } from '@/stores/gameStore';
import { useUserStore } from '@/stores/userStore';
import { useGameSession } from '@/composables/useGameSession';
import { useGameClock } from '@/composables/useGameClock';
import { useSudokuGame } from '@/composables/useSudokuGame';
import { useDialog } from '@/composables/useDialog';

const { difficulty } = defineProps<{ difficulty: DifficultyRating }>()
const userStore = useUserStore()
const gameStore = useGameStore()
const { resetBoard } = useSudokuGame()
const { showDialog } = useDialog()
const clock = useGameClock()
const { saveToServer, startNewPuzzle, loadLocal, saveLocal } = useGameSession()
const error = ref<string | null>(null)
const dialogOpen = ref(false);

onMounted(async () => {
  gameStore.loading = true;
  loadLocal()
  if (!gameStore.puzzleId || gameStore.difficultyRating !== difficulty) {
    await startNewPuzzle(difficulty)
  }
  clock.start()
  gameStore.loading = false
})

onBeforeRouteUpdate((to, _from) => {
  if (typeof to.params.difficulty !== 'string' || !PUZZLE_DIFFICULTY_ROUTES.includes(to.params.difficulty)) {
    toast.error(`'${to.params.difficulty}' is not an accepted difficulty. Currently only 'beginner', 'easy', 'medium', and 'hard' are playable.`)
    return false
  }
})

onBeforeRouteLeave(async () => {
  saveLocal()
  if (userStore.isAuthenticated && gameStore.puzzleId) {
    toast.promise(saveToServer(), {
      success: 'Game Saved!',
      loading: 'Saving game state...',
      error: 'Oops! An error occured saving!'
    })
  }
})

const loading = computed(() => {
  return userStore.loading || gameStore.loading
})



watchDebounced(() => gameStore.history.length, () => {
  saveToServer()
}, { debounce: 5000, maxWait: 10000 })

onUnmounted(() => {
  clock.pause()
  saveLocal()
})

watch(() => gameStore.isSolved, () => {
  if (gameStore.isSolved) {
    handlePuzzleSolved()
  }
})
const handlePuzzleSolved = async () => {
  clock.halt()
  dialogOpen.value = true;
  gameStore.state = 'solved';
  saveLocal()
  saveToServer()
}
const toggleTimer = () => {
  if (!clock.isRunning) {
    clock.start()
  } else {
    clock.pause()
  }
}

const handleReset = () => {
  clock.pause()
  showDialog({
    title: "Reset Board",
    message: 'This action cannot be undone, are you sure you want to continue?',
    buttons: [
      {
        text: 'Cancel',
        onClick: () => {
          clock.start()
        },
        closeOnClick: true
      },
      {
        text: "Reset",
        onClick: () => {
          resetBoard();
          clock.start();
        },
        variant: 'destructive',
        closeOnClick: true
      }
    ]
  })
}
</script>

<template>
  <div class="flex flex-col h-full items-center justify-center">
    <div class="w-full flex items-center justify-center bg-gray-50 dark:bg-accent">
      {{ difficulty.charAt(0).toUpperCase() + difficulty.substring(1) }}
      {{ gameStore.formattedTime }}
      <div class="flex items-center my-2">
        <Button class="mx-2" @click="toggleTimer" variant="ghost">
          <Icon v-if="clock.isRunning" icon="material-symbols:pause-rounded" />
          <Icon v-else icon="material-symbols:play-arrow-rounded" />
        </Button>
        <ControlInstructions />
        <Button variant="ghost" class="mr-2 my-0 text-sm" @click="handleReset">Reset</Button>
      </div>
    </div>

    <div class="flex pt-4 flex-col justify-end h-full md:flex-row">
      <SudokuPuzzle v-if="gameStore.puzzleId" />
      <SudokuControls />
    </div>
    <Dialog :open="dialogOpen" @update:open="(event) => dialogOpen = event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Puzzle Complete!
          </DialogTitle>
          <DialogDescription>
            You did it!
          </DialogDescription>
        </DialogHeader>
        Time: {{ gameStore.formattedTime }}
        <DialogFooter class="gap-1">
          <DialogClose as-child>
            <Button variant="secondary" @click="dialogOpen = false">
              Close
            </Button>
          </DialogClose>
          <Button @click="() => { startNewPuzzle(difficulty); dialogOpen = false }">
            New Puzzle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  <!-- <SaveGameDialog /> -->
  <LoadingOverlay v-if="loading" />
  <ErrorDialog v-if="error" :message="error" />
  <PauseMenu />
</template>
