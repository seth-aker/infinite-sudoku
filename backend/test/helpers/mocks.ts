import { vi, type Mocked } from "vitest";
import type { UserDataSource } from "@/feature/users/datasource/userDataSource";
import type { RefreshTokenDataSource } from "@/feature/auth/datasource/refreshTokenDataSource";
import type { ResetTokenDataSource } from "@/feature/auth/datasource/resetTokenDataSource";
import type { ValidateTokenDataSource } from "@/feature/auth/datasource/validateTokenDataSource";
import type { AuthenticationService } from "@/feature/auth/service/authenticationService";
import type { SudokuDataSource } from "@/feature/sudoku/datasource/sudokuDataSource";
import type { SudokuService } from "@/feature/sudoku/service/sudokuService";
import type { UserService } from "@/feature/users/service/userService";
import type { Emailer } from "@/feature/auth/email/smtpEmailer";

export function mockUserDataSource(): Mocked<UserDataSource> {
  return {
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    getUserStats: vi.fn(),
    changePassword: vi.fn(),
    deleteUser: vi.fn(),
  };
}

export function mockRefreshTokenDataSource(): Mocked<RefreshTokenDataSource> {
  return {
    close: vi.fn(),
    rotateRefreshToken: vi.fn(),
    create: vi.fn(),
    invalidateAllForUser: vi.fn(),
    delete: vi.fn(),
  };
}

export function mockResetTokenDataSource(): Mocked<ResetTokenDataSource> {
  return {
    createResetToken: vi.fn(),
    consumeToken: vi.fn(),
  };
}

export function mockValidateTokenDataSource(): Mocked<ValidateTokenDataSource> {
  return {
    createValidateToken: vi.fn(),
    validateEmail: vi.fn(),
  };
}

export function mockEmailer(): Mocked<Emailer> {
  return { sendMail: vi.fn() } as unknown as Mocked<Emailer>;
}

export type MockAuthService = Mocked<AuthenticationService> & {
  requestEmailVerification: ReturnType<typeof vi.fn>;
};

export function mockAuthService(): MockAuthService {
  return {
    verify: vi.fn(),
    registerUser: vi.fn(),
    getNewTokenSet: vi.fn(),
    refreshAccessToken: vi.fn(),
    clearRefreshToken: vi.fn(),
    requestPasswordResetToken: vi.fn(),
    resetPassword: vi.fn(),
    validateEmail: vi.fn(),
    requestEmailVerification: vi.fn(),
  };
}

export function mockSudokuDataSource(): Mocked<SudokuDataSource> {
  return {
    getNewPuzzle: vi.fn(),
    getPuzzleById: vi.fn(),
    getPuzzles: vi.fn(),
    createPuzzles: vi.fn(),
    getUserPuzzle: vi.fn(),
    updateUserPuzzle: vi.fn(),
    deletePuzzle: vi.fn(),
  };
}

export function mockSudokuService(): Mocked<SudokuService> {
  return {
    getNewPuzzle: vi.fn(),
    getPuzzles: vi.fn(),
    createPuzzles: vi.fn(),
    getUserPuzzle: vi.fn(),
    updateUserPuzzle: vi.fn(),
    deletePuzzle: vi.fn(),
  };
}

export function mockUserService(): Mocked<UserService> {
  return {
    getUser: vi.fn(),
    getUserStats: vi.fn(),
    deleteUser: vi.fn(),
  };
}
