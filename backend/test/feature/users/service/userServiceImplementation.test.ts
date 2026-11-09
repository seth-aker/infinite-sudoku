import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/core/errors/notFoundError";
import type { ISqlUser } from "@/feature/users/datasource/models/user";
import type { UserDataSource } from "@/feature/users/datasource/userDataSource";
import { UserServiceImplementation } from "@/feature/users/service/userServiceImplementation";
import type { UserService } from "@/feature/users/service/userService";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";

function sqlUser(overrides: Partial<ISqlUser> = {}): ISqlUser {
  return {
    user_id: USER_ID,
    email: "player@example.com",
    email_verified: true,
    username: "player",
    role: "user",
    image_url: "http://img.test/a.png",
    current_puzzle_id: "puzzle-1",
    last_login_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("UserServiceImplementation", () => {
  const users = {
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    getUserStats: vi.fn(),
    changePassword: vi.fn(),
    deleteUser: vi.fn(),
  };
  let service: UserService;

  beforeEach(() => {
    UserServiceImplementation.instance = null;
    service = UserServiceImplementation.create(users as unknown as UserDataSource);
  });

  it("returns the same instance on later create calls", () => {
    expect(UserServiceImplementation.create({} as UserDataSource)).toBe(service);
  });

  describe("getUser", () => {
    it("returns the user as a DTO", async () => {
      users.getUser.mockResolvedValue(sqlUser());
      await expect(service.getUser(USER_ID)).resolves.toEqual({
        id: USER_ID,
        email: "player@example.com",
        username: "player",
        role: "user",
        imageUrl: "http://img.test/a.png",
        currentPuzzleId: "puzzle-1",
      });
      expect(users.getUser).toHaveBeenCalledWith(USER_ID);
    });

    it("never exposes the password hash, salt or timestamps", async () => {
      users.getUser.mockResolvedValue(
        sqlUser({ password_hash: "hash", salt: "salt", deleted_at: null }),
      );
      const dto = await service.getUser(USER_ID);
      expect(Object.keys(dto).sort()).toEqual(
        ["currentPuzzleId", "email", "id", "imageUrl", "role", "username"],
      );
    });

    it("propagates NotFoundError from the data source", async () => {
      const err = new NotFoundError("missing");
      users.getUser.mockRejectedValue(err);
      await expect(service.getUser(USER_ID)).rejects.toBe(err);
    });
  });

  describe("getUserStats", () => {
    it("returns the stats", async () => {
      const stats = [
        { rating: "easy", avgScore: 1, totalStarted: 2, completed: 1, avgTimeSec: 60, totalTimeSec: 120 },
      ];
      users.getUserStats.mockResolvedValue(stats);
      await expect(service.getUserStats(USER_ID)).resolves.toEqual(stats);
      expect(users.getUserStats).toHaveBeenCalledWith(USER_ID);
    });

    it("throws NotFoundError when the user has no stats", async () => {
      users.getUserStats.mockResolvedValue([]);
      await expect(service.getUserStats(USER_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("deleteUser", () => {
    it("returns the data source result", async () => {
      users.deleteUser.mockResolvedValue(1);
      await expect(service.deleteUser(USER_ID)).resolves.toBe(1);
      expect(users.deleteUser).toHaveBeenCalledWith(USER_ID);
    });
  });
});
