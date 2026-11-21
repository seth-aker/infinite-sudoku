import { type DifficultyRating } from "@/stores/gameStore";

export const newOrOverwriteDialog = (opts: {
  difficulty: DifficultyRating,
  startFresh: (difficulty: DifficultyRating) => Promise<void>,
  resumePuzzle: () => Promise<void>,
}) => {
  const { difficulty, startFresh, resumePuzzle } = opts;
  return {
    title: "Overwrite current game?",
    message: "You have a current game in progress. Would you like to " +
      "overwrite your progress and start a new game?",
    buttons: [
      {
        text: "Resume saved game",
        onClick: () => {
          // do not return the promise
          resumePuzzle()
        },
        closeOnClick: true,
      },
      {
        text: "New Game",
        onClick: () => {
          // do not return the promise
          startFresh(difficulty)
        },
        closeOnClick: true,
      }
    ]
  }
}
