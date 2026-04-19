<script setup lang='ts'>
import SudokuControls from '@/components/SudokuControls.vue';
import ControlInstructions from '@/components/ControlInstructions.vue';
import SudokuPuzzle from '@/components/SudokuPuzzle.vue';
import { useSudokuStore } from '@/stores/sudokuStore'
import { useGameStore } from '@/stores/gameStore'
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
import { useRouter } from 'vue-router';
import type { Difficulty } from '@/stores/models/difficulty';
// import { useAuth0 } from '@auth0/auth0-vue';
import { useUserStore } from '@/stores/userStore';
import LoadingOverlay from '@/components/LoadingOverlay.vue';
import ErrorDialog from '@/components/ErrorDialog.vue';
import PauseMenu from '@/components/PauseMenu.vue';
const sudokuStore = useSudokuStore();
const gameStore = useGameStore()
const userStore = useUserStore();
const router = useRouter();
const error = ref<string | null>(null)
const difficulty = ref(router.currentRoute.value.name?.toString() as Difficulty)
const dialogOpen = ref(false);

// const { isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0()

const loading = computed(() => {
  return userStore.userLoading || sudokuStore.loading
})
watch(() => loading, () => {
  if (loading) {
    gameStore.stopTimer()
  } else {
    gameStore.startTimer();
  }
})
const requestNewPuzzle = async (newDifficulty: Difficulty) => {
  let token = undefined;
  // if (isAuthenticated.value) {
  //   token = await getAccessTokenSilently();
  // }
  await sudokuStore.getNewPuzzle({ difficulty: newDifficulty }, token);
  gameStore.elapsedSeconds = 0;
}

onMounted(async () => {
  sudokuStore.$reset()
  // const puzzleValues = [
  //       [null,null,null,null,null,null,2,7,null],
  //       [6,null,null,null,5,null,null,3,null],
  //       [null,2,7,null,null,3,9,null,null],
  //       [null,null,2,3,null,8,null,1,null],
  //       [null, null,5,4,2,null,null,null,null],
  //       [null,null,null,null,null,null,8,null,null],
  //       [null,9,null,null,3,null,null,5,null],
  //       [2,null,null,7,null,null,null,9,3],
  //       [7,null,null,1,null,null,null,8,null]
  //     ]
  // for(let i = 0; i < sudokuStore.puzzle.rows.length; i++) {
  //       for(let j = 0; j < sudokuStore.puzzle.rows.length; j++) {
  //         sudokuStore.puzzle.rows[i][j].value = puzzleValues[i][j]
  //       }
  //     }
  // sudokuStore.puzzle
  if (!sudokuStore.retrieveLocalState() || sudokuStore.puzzle.options.difficulty !== difficulty.value) {
    try {
      await requestNewPuzzle(difficulty.value)
      gameStore.startTimer();
    } catch (err) {
      if (typeof err === 'string') {
        error.value = err
      } else if (typeof err === 'object' && err instanceof Error) {
        error.value = err.message
      }
    }
  } else {
    // If sudokuStore.retrieveLocalState returns true, start game timer where it left off.
    gameStore.loadElapsedSecondsLocal()
    gameStore.startTimer()
  }
})
onUnmounted(() => {
  gameStore.stopTimer();
  gameStore.gameState = 'not-started'
  gameStore.elapsedSeconds = 0;
})

watch(() => sudokuStore.isPuzzleSolved, () => {
  if (sudokuStore.isPuzzleSolved) {
    handlePuzzleSolved()
  }
})
const handlePuzzleSolved = async () => {
  gameStore.stopTimer();
  dialogOpen.value = true;
  gameStore.gameState = 'solved';
  // const token = await getAccessTokenSilently()
  // userStore.updateUser(token);
}
const toggleTimer = () => {
  if (gameStore.interval === null) {
    gameStore.startTimer();
  } else {
    gameStore.pauseGame()
  }
}

const handleReset = () => {
  if (confirm('This action cannot be undone, are you sure you want to continue?')) {
    sudokuStore.resetPuzzle();
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <div class="w-full flex items-center justify-center bg-gray-50">
      {{ difficulty.charAt(0).toUpperCase() + difficulty.substring(1) }}
      {{ gameStore.formattedElapsedTime }}
      <div class="flex items-center my-2">
        <Button class="mx-2" @click="toggleTimer" variant="ghost">
          <Icon v-if="gameStore.interval" icon="material-symbols:pause-rounded" />
          <Icon v-else icon="material-symbols:play-arrow-rounded" />
        </Button>
        <ControlInstructions />
        <Button variant="ghost" class="mr-2 my-0 text-sm" @click="handleReset">Reset</Button>
      </div>
    </div>

    <div class="flex pt-4">
      <SudokuPuzzle v-if="sudokuStore.puzzle" :puzzle="sudokuStore.puzzle"
        v-model:selected-cell="sudokuStore.selectedCell" />
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
        Time: {{ gameStore.formattedElapsedTime }}
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="secondary" @click="dialogOpen = false">
              Close
            </Button>
          </DialogClose>
          <Button @click="() => { requestNewPuzzle(difficulty); dialogOpen = false }">
            New Puzzle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  <LoadingOverlay v-if="loading" />
  <ErrorDialog v-if="error" :message="error" />
  <PauseMenu />
</template>
