import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRouter } from "@/feature/users/routing/userRouter";
import { NotFoundError } from "@/core/errors/notFoundError";
import {
  bearer,
  buildApp,
  startServer,
  type TestServer,
} from "#test/helpers/http";
import { mockUserService } from "#test/helpers/mocks";
import { signAccessToken } from "#test/helpers/jwt";
import { OTHER_USER_ID, USER_ID } from "#test/helpers/fixtures";

const userDto = {
  id: USER_ID,
  email: "user@example.com",
  username: "player",
  role: "user" as const,
};
const stats = [
  {
    rating: "easy" as const,
    avgScore: 1,
    totalStarted: 2,
    completed: 1,
    avgTimeSec: 30,
    totalTimeSec: 60,
  },
];

describe("UserRouter", () => {
  const service = mockUserService();
  let server: TestServer;
  let userAuth: Record<string, string>;
  let adminAuth: Record<string, string>;

  beforeAll(async () => {
    server = await startServer(buildApp("/users", UserRouter(service)));
    userAuth = bearer(await signAccessToken({ sub: USER_ID, role: "user" }));
    adminAuth = bearer(
      await signAccessToken({ sub: OTHER_USER_ID, role: "admin" }),
    );
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GET /me", () => {
    it("requires authentication", async () => {
      const res = await server.get("/users/me");
      expect(res.status).toBe(401);
      expect(service.getUser).not.toHaveBeenCalled();
    });

    it("returns the current user", async () => {
      service.getUser.mockResolvedValue(userDto);
      const res = await server.get("/users/me", userAuth);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user: userDto });
      expect(service.getUser).toHaveBeenCalledWith(USER_ID);
    });

    it("is matched before /:id", async () => {
      service.getUser.mockResolvedValue(userDto);
      const res = await server.get("/users/me", userAuth);
      expect(res.status).not.toBe(400);
    });

    it("responds 404 when the user no longer exists", async () => {
      service.getUser.mockRejectedValue(new NotFoundError("gone"));
      const res = await server.get("/users/me", userAuth);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /:id", () => {
    it("requires authentication", async () => {
      const res = await server.get(`/users/${USER_ID}`);
      expect(res.status).toBe(401);
    });

    it("returns the user when requesting self", async () => {
      service.getUser.mockResolvedValue(userDto);
      const res = await server.get(`/users/${USER_ID}`, userAuth);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user: userDto });
      expect(service.getUser).toHaveBeenCalledWith(USER_ID);
    });

    it("allows admins to fetch other users", async () => {
      service.getUser.mockResolvedValue(userDto);
      const res = await server.get(`/users/${USER_ID}`, adminAuth);
      expect(res.status).toBe(200);
    });

    it("forbids users from fetching other users", async () => {
      const res = await server.get(`/users/${OTHER_USER_ID}`, userAuth);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "insufficient_role" });
      expect(service.getUser).not.toHaveBeenCalled();
    });

    it("responds 400 for a non-uuid id", async () => {
      const res = await server.get("/users/not-a-uuid", userAuth);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /:id/stats", () => {
    it("returns stats for self", async () => {
      service.getUserStats.mockResolvedValue(stats);
      const res = await server.get(`/users/${USER_ID}/stats`, userAuth);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ stats });
      expect(service.getUserStats).toHaveBeenCalledWith(USER_ID);
    });

    it("allows admins", async () => {
      service.getUserStats.mockResolvedValue(stats);
      const res = await server.get(`/users/${USER_ID}/stats`, adminAuth);
      expect(res.status).toBe(200);
    });

    it("forbids other users", async () => {
      const res = await server.get(`/users/${OTHER_USER_ID}/stats`, userAuth);
      expect(res.status).toBe(403);
      expect(service.getUserStats).not.toHaveBeenCalled();
    });

    it("responds 404 when there are no stats", async () => {
      service.getUserStats.mockRejectedValue(new NotFoundError("none"));
      const res = await server.get(`/users/${USER_ID}/stats`, userAuth);
      expect(res.status).toBe(404);
    });

    it("requires authentication", async () => {
      const res = await server.get(`/users/${USER_ID}/stats`);
      expect(res.status).toBe(401);
    });
  });
});
