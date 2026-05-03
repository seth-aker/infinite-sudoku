import { SudokuPuzzle, type SudokuOptions } from "@/stores/models/puzzle";
import { config } from '@/config/index'
import type { SudokuStoreState } from "@/stores/models/sudokuStoreState";
import type { Difficulty } from "@/stores/models/difficulty";
import type { SaveGameOptions } from "@/stores/models/gameState";
import { deserializeAction, deserializeCells, serializeAction, serializePuzzle } from "@/utils/serialization";
import type { Action } from "@/stores/models/action";
import type { ServiceResult } from "./baseService";
const {API_BASE_URL} = config;
export interface NewPuzzleDto {
  _id: string,
  cells: string;
  candidates?: string
  difficulty: Difficulty
}
export interface UpdateUserPuzzleDto {
  _id: string,
  cells: string,
  candidates: string,
  time: number
  isCompleted: boolean,
  actions: number[]
} 
export interface UserPuzzleDto {
  _id: string,
  isCompleted: boolean,
  currentCells: string,
  currentCandidates: string, 
  time: number,
  originalCells: string,
  difficulty: Difficulty,
  actions?: number[]
}
async function fetchNewPuzzle(options?: SudokuOptions): Promise<ServiceResult<{_id: string, puzzle: SudokuPuzzle}>> {
  const fetchOptions: RequestInit = {
    method: "GET",
    headers: {"Content-Type": "application/json"},
    credentials: 'include'
  }
  try {
    const response = await fetch(`${API_BASE_URL}/sudoku/new?difficulty=${options?.difficulty.rating || 'beginner'}`, fetchOptions)
    if(!response.ok) {
      const errData = await response.json();
      console.log(errData)
      throw new Error(errData.message || `API Error: ${response.status}`)
    }
    const puzzleDTO = await response.json() as NewPuzzleDto
    const puzzle = deserializePuzzle(puzzleDTO)
    return {body: {puzzle, _id: puzzleDTO._id}, success: true}
  } catch (err) {
    return {success: false, message: (err as Error).message}
  }
}
async function fetchPuzzle(puzzleId: string): Promise<ServiceResult<{_id: string, puzzle:SudokuPuzzle, actions: Action[], time: number}>> {
  try {
    const res = await fetch(`${API_BASE_URL}/sudoku/${puzzleId}`, {
      method: "GET",
      headers: {
        "Content-Type": 'application/json'
      },
      credentials: 'include'
    })
    if(!res.ok) {
      const errData = await res.json()
      console.log(errData)
      return { success: false, message: errData.message}
    } 
    const puzzleDto = await res.json() as UserPuzzleDto
    const puzzle = deserializeUserPuzzle(puzzleDto);
    const actions = puzzleDto.actions ? puzzleDto.actions.map(action => deserializeAction(action)) : [] as Action[]
    return {success: true, body: {puzzle, _id: puzzleDto._id, actions, time: puzzleDto.time}}
  } catch (err) {
    return {success: false, message: (err as Error).message}
  }
}
async function updatePuzzle(puzzleId: string, puzzle: SudokuPuzzle, actions: Action[], elapsedTime: number, isCompleted: boolean, options: SaveGameOptions): Promise<ServiceResult<void>> {
  const puzzleDto = serializePuzzle(puzzleId, puzzle);
  const updateDto: UpdateUserPuzzleDto = {
    _id: puzzleDto._id,
    cells: puzzleDto.cells,
    candidates: puzzleDto.candidates!,
    time: elapsedTime,
    isCompleted,
    actions: actions.map(action => serializeAction(action))
  }
  try {
    const res = await fetch(`${API_BASE_URL}/sudoku/${puzzleId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(updateDto),
      credentials: 'include',
      keepalive: options.keepalive
    })
    if(!res.ok) {
      const error = await res.json()
      console.log(error)
      return {message: error.message, success: false}
    }
    return {success: true}
  } catch (err) {
    if(typeof err === 'string') {
      return {message: err, success: false}
    } else {
      return {message: (err as Error).message, success:false}
    }
  }
}
function saveGameStateLocally(state: SudokuStoreState ) {
  const stateString = JSON.stringify(state);
  localStorage.setItem('localGameState', stateString);
}
function retrieveLocalState(): SudokuStoreState | null {
  const stateString = localStorage.getItem('localGameState');
  if(stateString === null) return null;
  const stateObj: SudokuStoreState = JSON.parse(stateString);
  stateObj.puzzle = SudokuPuzzle.fromJSON(stateObj.puzzle)
  return stateObj;
}
function deleteGameStateLocally() {
  localStorage.removeItem('localGameState')
}

function deserializePuzzle(puzzle: NewPuzzleDto): SudokuPuzzle {
  const rows = deserializeCells(puzzle.cells)
  return new SudokuPuzzle(rows, { difficulty: puzzle.difficulty})
}
export function deserializeUserPuzzle(userPuzzle: UserPuzzleDto) {
  const originalRows = deserializeCells(userPuzzle.originalCells);
  const currentRows = deserializeCells(userPuzzle.originalCells, userPuzzle.currentCells, userPuzzle.currentCandidates)
  return new SudokuPuzzle(currentRows, {difficulty: userPuzzle.difficulty}, originalRows)
}



export default {fetchNewPuzzle, fetchPuzzle, updatePuzzle, saveGameStateLocally, retrieveLocalState, deleteGameStateLocally}
