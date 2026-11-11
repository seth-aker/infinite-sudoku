import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "@/app";
import { config } from "@/core/config";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { SudokuRouter } from "@/feature/sudoku/routing/sudokuRouter";
import type { SudokuService } from "@/feature/sudoku/service/sudokuService";
import { startServer, type TestServer } from "#test/helpers/http";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const PUZZLE_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const SECRET = new TextEncoder().encode(config.jwtSecret);

const NEW_PUZZLE = { puzzleId: PUZZLE_ID, cells: "0".repeat(81), rating: "easy", score: 10 };
const USER_PUZZLE = {
  puzzleId: PUZZLE_ID,
  isCompleted: false,
  cells: "0".repeat(81),
  candidates: Array(81).fill("").join(":"),
  time: 0,
  actions: [],
};

function accessToken(sub = USER_ID) {
  return new SignJWT({ role: "user", emailVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(SECRET);
}

describe("SudokuRouter", () => {
  const service = {
    getNewPuzzle: vi.fn(),
    getPuzzles: vi.fn(),
    createPuzzles: vi.fn(),
    getUserPuzzle: vi.fn(),
    updateUserPuzzle: vi.fn(),
    deletePuzzle: vi.fn(),
  };
  let server: TestServer;
  let auth: { authorization: string };

  beforeEach(async () => {
    service.getNewPuzzle.mockResolvedValue(NEW_PUZZLE);
    service.getUserPuzzle.mockResolvedValue(USER_PUZZLE);
    service.updateUserPuzzle.mockResolvedValue(1);
    auth = { authorization: `Bearer ${await accessToken()}` };
    const app = createApp({
      config: { ...config, isProduction: false },
      routers: [
        { path: "/sudoku", router: new SudokuRouter(service as unknown as SudokuService).setup() },
      ],
    });
    server = await startServer(app);
  });

  afterEach(async () => {
    await server.close();
  });

  describe("GET /new", () => {
    it("returns a new easy puzzle by default", async () => {
      const res = await server.get("/api/sudoku/new");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(NEW_PUZZLE);
      expect(service.getNewPuzzle).toHaveBeenCalledWith(undefined, { difficulty: "easy" });
    });

    it.each(["beginner", "easy", "medium", "hard"])(
      "passes the requested difficulty (%s) to the service",
      async (difficulty) => {
        const res = await server.get(`/api/sudoku/new?difficulty=${difficulty}`);
        expect(res.status).toBe(200);
        expect(service.getNewPuzzle).toHaveBeenCalledWith(undefined, { difficulty });
      },
    );

    it.each([
      ["an unknown difficulty", "?difficulty=extreme"],
      ["impossible, which can't be served", "?difficulty=impossible"],
      ["an empty difficulty", "?difficulty="],
      ["a repeated difficulty", "?difficulty=easy&difficulty=hard"],
    ])("rejects %s with a 400", async (_label, query) => {
      const res = await server.get(`/api/sudoku/new${query}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(ErrorType.VALIDATION_FAILED);
      expect(service.getNewPuzzle).not.toHaveBeenCalled();
    });

    it("works without logging in", async () => {
      const res = await server.get("/api/sudoku/new");
      expect(res.status).toBe(200);
    });

    it("passes the logged-in user's id so they get a puzzle they haven't played", async () => {
      await server.get("/api/sudoku/new?difficulty=easy", auth);
      expect(service.getNewPuzzle).toHaveBeenCalledWith(USER_ID, { difficulty: "easy" });
    });

    it("passes service errors through", async () => {
      service.getNewPuzzle.mockRejectedValue(new Error("generator crashed"));
      const res = await server.get("/api/sudoku/new");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:puzzleId", () => {
    it("returns the user's progress on the puzzle", async () => {
      const res = await server.get(`/api/sudoku/${PUZZLE_ID}`, auth);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(USER_PUZZLE);
      expect(service.getUserPuzzle).toHaveBeenCalledWith(USER_ID, PUZZLE_ID);
    });

    it("returns 401 without an access token", async () => {
      const res = await server.get(`/api/sudoku/${PUZZLE_ID}`);
      expect(res.status).toBe(401);
      expect(service.getUserPuzzle).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-uuid puzzle id", async () => {
      const res = await server.get("/api/sudoku/not-a-uuid", auth);
      expect(res.status).toBe(400);
      expect(service.getUserPuzzle).not.toHaveBeenCalled();
    });

    it("returns 404 when the user has no such puzzle", async () => {
      service.getUserPuzzle.mockRejectedValue(
        new NotFoundError("No puzzle", { type: ErrorType.RESOURCE_NOT_FOUND }),
      );
      const res = await server.get(`/api/sudoku/${PUZZLE_ID}`, auth);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:puzzleId", () => {
    const put = (body: unknown, headers: Record<string, string> = auth) =>
      server.request(`/api/sudoku/${PUZZLE_ID}`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });

    it("saves the user's progress and returns 204", async () => {
      const body = { ...USER_PUZZLE, time: 42, actions: [1, 2, 3] };
      const res = await put(body);
      expect(res.status).toBe(204);
      expect(service.updateUserPuzzle).toHaveBeenCalledWith(USER_ID, body);
    });

    it("accepts candidates with digits 1-9", async () => {
      const candidates = ["123456789", "5", ...Array(79).fill("")].join(":");
      const res = await put({ ...USER_PUZZLE, candidates });
      expect(res.status).toBe(204);
    });

    it("returns 401 without an access token", async () => {
      const res = await put(USER_PUZZLE, {});
      expect(res.status).toBe(401);
      expect(service.updateUserPuzzle).not.toHaveBeenCalled();
    });

    it.each([
      ["a non-uuid puzzleId", { puzzleId: "abc" }],
      ["cells shorter than 81", { cells: "0".repeat(80) }],
      ["cells longer than 81", { cells: "0".repeat(82) }],
      ["too few candidate cells", { candidates: Array(80).fill("").join(":") }],
      ["a candidate of 0", { candidates: ["0", ...Array(80).fill("")].join(":") }],
      ["a non-digit candidate", { candidates: ["a", ...Array(80).fill("")].join(":") }],
      ["more than 9 candidates in a cell", { candidates: ["1234567891", ...Array(80).fill("")].join(":") }],
      ["a negative time", { time: -1 }],
      ["a string isCompleted", { isCompleted: "true" }],
      ["non-numeric actions", { actions: ["a"] }],
      ["missing actions", { actions: undefined }],
    ])("rejects %s with a 400", async (_label, override) => {
      const res = await put({ ...USER_PUZZLE, ...override });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(ErrorType.VALIDATION_FAILED);
      expect(service.updateUserPuzzle).not.toHaveBeenCalled();
    });

    it("returns 500 when the update does not affect exactly one row", async () => {
      service.updateUserPuzzle.mockResolvedValue(0);
      const res = await put(USER_PUZZLE);
      expect(res.status).toBe(500);
    });
  });
});
