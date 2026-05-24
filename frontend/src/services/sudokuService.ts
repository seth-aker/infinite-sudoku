import type { Action, Cell, DifficultyRating } from "@/stores/gameStore";
import { deserializeAction, deserializeCells, serializeAction, serializeCells } from "@/utils/serialization";
import { config } from "@/config";
import type { ServiceResult } from "./baseService";
const BASE_URL: string = config.API_BASE_URL;

export interface SudokuProgressState {
  puzzleId: string,
  cells: Cell[],
  history: Action[]
  elapsedSeconds: number,
  isSolved: boolean,
  keepAlive?: boolean
}
export interface UpdateProgressDTO {
  puzzleId: string,
  cells: string,
  candidates: string,
  time: number
  isCompleted: boolean,
  actions: number[]
}
export interface UserPuzzleDto {
  puzzleId: string,
  isCompleted: boolean,
  currentCells: string,
  currentCandidates: string, 
  time: number,
  originalCells: string,
  difficulty: {
    rating: DifficultyRating,
    score: number
  }
  actions?: number[]
}

export interface NewPuzzleResult {
  puzzleId: string
  difficultyRating: DifficultyRating,
  difficultyScore: number
  cells: Cell[]
}
export interface SavedPuzzleResult {
  puzzleId: string
  difficultyRating: DifficultyRating,
  difficultyScore: number
  originalCells: Cell[]
  cells: Cell[]
  actions: Action[]
  elapsedSeconds: number
}
export async function getNewPuzzle(difficulty: DifficultyRating): Promise<ServiceResult<NewPuzzleResult>> {
  const result = await fetch(`${BASE_URL}/sudoku/new?difficulty=${difficulty}`, {
    method: 'GET',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include'
  })
  if(!result.ok) {
    return {
      success: false,
      error: await result.text()
    }
  }
  const rawPuzzle = await result.json()
  const cells = deserializeCells({cells: rawPuzzle.cells})
  return {
    success: true,
    body: {
      cells,
      puzzleId: rawPuzzle.puzzleId,
      difficultyRating: rawPuzzle.difficulty.rating,
      difficultyScore: rawPuzzle.difficulty.score
    }
  }
}
export async function saveProgress(progress: SudokuProgressState): Promise<ServiceResult<void>> {
  const {keepAlive, ...state} = progress;
  const { cells, candidates } = serializeCells(progress.cells);
  const actions = progress.history.map(each => serializeAction(each))
  const body: UpdateProgressDTO = {
    puzzleId: state.puzzleId,
    cells,
    candidates: candidates!,
    actions,
    time: state.elapsedSeconds,
    isCompleted: state.isSolved
  }

  const response = await fetch(`${BASE_URL}/sudoku/${progress.puzzleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    keepalive: progress.keepAlive,
    body: JSON.stringify(body),
    credentials: 'include'
  })

  if(!response.ok) {
    return {
      success: false,
      error: await response.json()
    }
  }
  return {
    success: true
  }
}

export async function getSavedProgress(puzzleId: string): Promise<ServiceResult<SavedPuzzleResult>> {
  const response = await fetch(`${BASE_URL}/sudoku/${puzzleId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })
  if(!response.ok) {
    return {
      success: false,
      error: await response.text()
    }
  }
  const body = await response.json() as UserPuzzleDto
  const cells = deserializeCells({cells: body.currentCells, candidates: body.currentCandidates})
  const originalCells = deserializeCells({cells: body.originalCells})
  const actions = body.actions?.map(each => deserializeAction(each)) ?? []

  return {
    success: true,
    body: {
      puzzleId: body.puzzleId,
      cells,
      originalCells,
      actions,
      elapsedSeconds: body.time,
      difficultyRating: body.difficulty.rating,
      difficultyScore: body.difficulty.score
    }
  }
}
