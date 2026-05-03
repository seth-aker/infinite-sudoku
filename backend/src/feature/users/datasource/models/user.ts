import { UserPuzzleDto } from "@/feature/sudoku/datasource/models/sudokuPuzzle"

export interface ISqlUser {
  user_id: string,
  display_name?: string,
  username: string,
  role: string,
  password_hash?: string,
  salt?: string,
  image_url?: string,
  current_puzzle_id?: string,
  created_at: string,
  updated_at: string,
  deleted_at?: string | null
}

export interface ICreateUser {
  displayName?: string,
  username: string,
  passwordHash: string,
  salt: string
}

export interface IUserDTO {
  id: string,
  username: string,
  role: string,
  displayName?: string,
  imageUrl?: string,
  currentPuzzleId?: string
}
