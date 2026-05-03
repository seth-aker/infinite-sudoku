import { type PuzzleOptions } from "../datasource/models/puzzleOptions";
import { type CreatePuzzle } from "../datasource/models/sudokuPuzzle";
import { spawn } from 'node:child_process'
import { env } from 'node:process'
import { workerEmit, worker } from "workerpool";
import { type DifficultyRating } from "../datasource/models/difficulty";
import { config } from "../../../core/config";
import { PuzzleGeneratorError } from "../errors/puzzleGeneratorError";
export function generatePuzzles(number: number, options: PuzzleOptions) {
  const generatorPath = `${config.rootDir}/puzzle_generator_app`;
  let difficulty: string;
  switch (options.difficulty) {
    case 'easy': 
      difficulty = "EASY";
      break;
    case 'medium':
      difficulty = "MEDIUM";
      break;
    case 'hard': 
      difficulty = "HARD";
      break;
    case "impossible":
      difficulty = "IMPOSSIBLE";
      break;
    default:
      difficulty = "BEGINNER"
      break;
  }

  const args = [
    difficulty,
    `${number}`
  ];
  return new Promise<void>((resolve, reject) => {
    const generator = spawn(generatorPath, args, {env: env})
    let buffer = '';
    generator.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for(const line of lines) {
        if(line.trim().length > 0) {
          const puzzle = processPuzzle(line);
          workerEmit(puzzle);
        }
      }  
    })
    generator.on('close', (code) => {
      if(buffer.trim().length > 0) {
        const puzzle = processPuzzle(buffer);
        workerEmit(puzzle);
      }
      if(code === 0) {
        resolve();
      } else {
        reject(new PuzzleGeneratorError(`Generator exited with code ${code}`))
      }
    })
    generator.on('error', (err) => {
      reject(err);
    })
  })
}
worker({generatePuzzles})

function processPuzzle(puzzleString: string): CreatePuzzle {
  const [cellValues, solvedCells, difficultyScoreStr, difficultyRatingNum] = puzzleString.split(":");
  const difficultyScore = Number.parseInt(difficultyScoreStr);
  let difficultyRating: DifficultyRating;
  switch (difficultyRatingNum) {
    case '0':
        difficultyRating = 'beginner'
      break;
    case '1':
      difficultyRating = 'easy'
      break;
    case '2':
      difficultyRating = 'medium'
      break
    case '3':
      difficultyRating = 'hard'
      break;
    default:
      difficultyRating = 'impossible'
      break;
  }
  
  return {
    cells: cellValues,
    solvedCells,
    difficulty: {
      score: difficultyScore,
      rating: difficultyRating
    }
  }
}
