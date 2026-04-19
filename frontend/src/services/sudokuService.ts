import { SudokuPuzzle, type SudokuOptions } from "@/stores/models/puzzle";
import { config } from '@/config/index'
import type { SudokuStoreState } from "@/stores/models/sudokuStoreState";
const {API_BASE_URL} = config;
async function fetchNewPuzzle(options?: SudokuOptions, token?: string) {
  const fetchOptions: RequestInit = {
    method: "GET",
    headers: {"Content-Type": "application/json"}
  }
  if(token) {
    fetchOptions.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  }
  try {
    const response = await fetch(`${API_BASE_URL}/sudoku/new?difficulty=${options?.difficulty}`, fetchOptions)
    if(!response.ok) {
      const errData = await response.json();
      console.log(errData)
      throw new Error(errData.message || `API Error: ${response.status}`)
    }
    return await response.json()
  } catch (err) {
    console.log(err)
  }
}
async function fetchPuzzle(puzzleId: string) {
  return await fetch(`${API_BASE_URL}/sudoku/${puzzleId}`)
}
async function updatePuzzle(puzzleId: string, puzzle: SudokuPuzzle) {
  return await fetch(`${API_BASE_URL}/sudoku/${puzzleId}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(puzzle)
  })
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
export default {fetchNewPuzzle, fetchPuzzle, updatePuzzle, saveGameStateLocally, retrieveLocalState, deleteGameStateLocally}
