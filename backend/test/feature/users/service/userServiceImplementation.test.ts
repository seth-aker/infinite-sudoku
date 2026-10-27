import { beforeEach, describe, expect, it } from "vitest";
import { UserServiceImplementation } from "@/feature/users/service/userServiceImplementation";
import { NotFoundError } from "@/core/errors/notFoundError";
import type { UserService } from "@/feature/users/service/userService";
import { mockUserDataSource } from "#test/helpers/mocks";
import { buildSqlUser, PUZZLE_ID, USER_ID } from "#test/helpers/fixtures";

describe("UserServiceImplementation", () => {
  let ds: ReturnType<typeof mockUserDataSource>;
  let service: UserService;

  beforeEach(() => {
    UserServiceImplementation.instance = null;
    ds = mockUserDataSource();
    service = UserServiceImplementation.create(ds);
  });

  it("is a singleton", () => {
    expect(UserServiceImplementation.create(mockUserDataSource())).toBe(
      service,
    );
  });

  describe("getUser", () => {
    it("serializes the user to a DTO without sensitive fields", async () => {
      ds.getUser.mockResolvedValue(
        buildSqlUser({ password_hash: "h", salt: "s" }),
      );
      const user = await service.getUser(USER_ID);
      expect(ds.getUser).toHaveBeenCalledWith(USER_ID);
      expect(user).toEqual({
        id: USER_ID,
        email: "user@example.com",
        username: "player",
        role: "user",
        imageUrl: "http://img.test/a.png",
        currentPuzzleId: PUZZLE_ID,
      });
    });

    it("keeps missing optional fields undefined", async () => {
      ds.getUser.mockResolvedValue(
        buildSqlUser({ image_url: undefined, current_puzzle_id: undefined }),
      );
      const user = await service.getUser(USER_ID);
      expect(user.imageUrl).toBeUndefined();
      expect(user.currentPuzzleId).toBeUndefined();
    });

    it("propagates NotFoundError", async () => {
      ds.getUser.mockRejectedValue(new NotFoundError("missing"));
      await expect(service.getUser(USER_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("getUserStats", () => {
    it("returns the stats", async () => {
      const stats = [
        {
          rating: "easy" as const,
          avgScore: 1,
          totalStarted: 1,
          completed: 1,
          avgTimeSec: 1,
          totalTimeSec: 1,
        },
      ];
      ds.getUserStats.mockResolvedValue(stats);
      await expect(service.getUserStats(USER_ID)).resolves.toBe(stats);
      expect(ds.getUserStats).toHaveBeenCalledWith(USER_ID);
    });

    it("throws NotFoundError when there are no stats", async () => {
      ds.getUserStats.mockResolvedValue([]);
      const err = await service.getUserStats(USER_ID).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toBe("No user stats found");
    });
  });

  describe("deleteUser", () => {
    it("delegates to the data source", async () => {
      ds.deleteUser.mockResolvedValue(1);
      await expect(service.deleteUser(USER_ID)).resolves.toBe(1);
      expect(ds.deleteUser).toHaveBeenCalledWith(USER_ID);
    });
  });
});
