import type { Action, Cell, DifficultyRating } from "@/stores/gameStore";
import {
  deserializeAction,
  deserializeCells,
  serializeAction,
  serializeCells,
} from "@/utils/serialization";
import { config } from "@/config";
import { safeFetch, type ServiceResult } from "./baseService";
const BASE_URL: string = config.API_BASE_URL;

export interface SudokuProgressState {
  puzzleId: string;
  cells: Cell[];
  history: Action[];
  elapsedSeconds: number;
  isSolved: boolean;
  keepAlive?: boolean;
}

export interface NewPuzzleDto {
  puzzleId: string,
  cells: string,
  rating: DifficultyRating,
  score: number
}
export interface UpdateProgressDTO {
  puzzleId: string;
  cells: string;
  candidates: string;
  time: number;
  isCompleted: boolean;
  actions: number[];
}
export interface UserPuzzleDto {
  puzzleId: string;
  isCompleted: boolean;
  cells: string;
  candidates: string;
  time: number;
  originalCells: string;
  rating: DifficultyRating;
  score: number;
  actions?: number[];
}

export interface NewPuzzleResult {
  puzzleId: string;
  difficultyRating: DifficultyRating;
  difficultyScore: number;
  cells: Cell[];
}
export interface SavedPuzzleResult {
  puzzleId: string;
  difficultyRating: DifficultyRating;
  difficultyScore: number;
  originalCells: Cell[];
  cells: Cell[];
  actions: Action[];
  elapsedSeconds: number;
}
export async function getNewPuzzle(
  difficulty: DifficultyRating,
): Promise<ServiceResult<NewPuzzleResult>> {
  const result = await safeFetch<NewPuzzleDto>(
    `${BASE_URL}/sudoku/new?difficulty=${difficulty}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  );
  if (!result.success) {
    return result;
  }
  const rawPuzzle = result.body;
  if(!rawPuzzle) {
    return {
      success: false,
      error: 'Puzzle not received',
      status: 500,
    }
  }
  const cells = deserializeCells({ cells: rawPuzzle.cells });
  return {
    success: true,
    body: {
      cells,
      puzzleId: rawPuzzle.puzzleId,
      difficultyRating: rawPuzzle.rating,
      difficultyScore: rawPuzzle.score,
    },
    status: result.status
  };
}
export async function saveProgress(
  progress: SudokuProgressState,
): Promise<ServiceResult<void>> {
  const { keepAlive, ...state } = progress;
  const { cells, candidates } = serializeCells(progress.cells);
  const actions = progress.history.map((each) => serializeAction(each));
  const body: UpdateProgressDTO = {
    puzzleId: state.puzzleId,
    cells,
    candidates: candidates!,
    actions,
    time: state.elapsedSeconds,
    isCompleted: state.isSolved,
  };

  const response = await safeFetch<void>(`${BASE_URL}/sudoku/${progress.puzzleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    keepalive: progress.keepAlive,
    body: JSON.stringify(body),
    credentials: "include",
  });

  return response;
}

export async function getSavedProgress(
  puzzleId: string,
): Promise<ServiceResult<SavedPuzzleResult>> {
  const response = await safeFetch<UserPuzzleDto>(`${BASE_URL}/sudoku/${puzzleId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if(!response.success) {
    return response;
  }
  const body = response.body;
  if(!body) {
    return {
      success: false,
      error: "Failed to get progress",
      status: 500,
    }
  }
  const cells = deserializeCells({
    cells: body.cells,
    candidates: body.candidates,
  });
  const originalCells = deserializeCells({ cells: body.originalCells });
  const actions = body.actions?.map((each) => deserializeAction(each)) ?? [];

  return {
    success: true,
    body: {
      puzzleId: body.puzzleId,
      cells,
      originalCells,
      actions,
      elapsedSeconds: body.time,
      difficultyRating: body.rating,
      difficultyScore: body.score,
    },
    status: response.status
  };
}
