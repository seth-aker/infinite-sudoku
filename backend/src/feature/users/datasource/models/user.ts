export interface ISqlUser {
  user_id: string;
  email: string;
  email_verified: boolean;
  username: string;
  role: "user" | "admin";
  password_hash?: string;
  salt?: string;
  image_url?: string;
  current_puzzle_id?: string;
  last_login_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ICreateUser {
  email: string;
  username: string;
  tosAcknowledged: boolean;
  passwordHash: string;
  salt: string;
  role: "user" | "admin";
}

export interface IUserDTO {
  id: string;
  username: string;
  role: "user" | "admin";
  email: string;
  imageUrl?: string;
  currentPuzzleId?: string;
}
