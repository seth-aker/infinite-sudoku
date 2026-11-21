import { useGameStore, type DifficultyRating } from "@/stores/gameStore";
import { useRoute, useRouter } from "vue-router";
import { useGameSession } from "./useGameSession";
import { useDialog } from "./useDialog";
import { useUserStore } from "@/stores/userStore";
import { toast } from "vue-sonner";
import { newOrOverwriteDialog } from "@/components/dialog/dialogTemplates";

export function usePuzzleNavigation() {
  const router = useRouter()
  const route = useRoute();
  const gameStore = useGameStore()
  const userStore = useUserStore()
  const { hasInProgressPuzzle, resumeSavedPuzzle, startNewPuzzle, clearLocal } = useGameSession();
  const { showDialog, closeDialog } = useDialog();

  async function resumePuzzle() {
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
      if (!result.body?.difficultyRating) {
        return;
      }
      router.push({
        name: "sudoku",
        params: { difficulty: result.body.difficultyRating },
      });
    }
  }

  async function startFresh(difficulty: DifficultyRating) {
    if (route.name === 'sudoku' && route.params.difficulty === difficulty) {
      await loadNewPuzzle(difficulty);
    } else {
      clearLocal();
      gameStore.$reset();
      router.push({ name: "sudoku", params: { difficulty } });
    }
  }

  async function chooseNewPuzzle(difficulty: DifficultyRating) {
    if (hasInProgressPuzzle.value) {
      showDialog(newOrOverwriteDialog({ difficulty, resumePuzzle, startFresh }))
    } else {
      await startFresh(difficulty);
    }
  }
  async function loadNewPuzzle(difficulty: DifficultyRating) {
    const result = await startNewPuzzle(difficulty);
    if (!result.success) {
      const savedDifficulty = gameStore.puzzleId ? gameStore.difficultyRating :
        undefined;
      // TODO: Make this a separate helper component for clarity
      showDialog({
        title: "Error Fetching Puzzle",
        message: result.error ?? `Error code: ${result.status}`,
        buttons: [
          {
            text: "Retry",
            onClick: async () => {
              closeDialog();
              await loadNewPuzzle(difficulty)
            },
          },
          ...(savedDifficulty && savedDifficulty !== difficulty ? [{
            text: `Back to ${savedDifficulty} game`,
            onClick: () => {
              router.push({
                name: 'sudoku', params: { difficulty: savedDifficulty }
              })
            },
            closeOnClick: true,
          }] : []),
          {
            text: "Cancel",
            onClick: () => {
              router.push({ name: 'home' })
            },
            closeOnClick: true,
          }
        ]
      })
    }
  }
  return {
    resumePuzzle,
    startFresh,
    chooseNewPuzzle,
    loadNewPuzzle,
  }
}
