import { afterAll, beforeAll, describe, expect, it } from "vitest";
import SudokuRouter from "@/feature/sudoku/routing/sudokuRouter";
import { NotFoundError } from "@/core/errors/notFoundError";
import { DatabaseError } from "@/core/errors/databaseError";
import {
  bearer,
  buildApp,
  startServer,
  type TestServer,
} from "#test/helpers/http";
import { mockSudokuService } from "#test/helpers/mocks";
import { signAccessToken } from "#test/helpers/jwt";
import {
  buildUserPuzzle,
  CELLS,
  PUZZLE_ID,
  USER_ID,
} from "#test/helpers/fixtures";

const puzzle = {
  puzzleId: PUZZLE_ID,
  cells: CELLS,
  score: 42,
  rating: "easy" as const,
};

describe("SudokuRouter", () => {
  const service = mockSudokuService();
  let server: TestServer;
  let auth: Record<string, string>;

  beforeAll(async () => {
    server = await startServer(buildApp("/sudoku", SudokuRouter(service)));
    auth = bearer(await signAccessToken({ sub: USER_ID }));
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GET /new", () => {
    it("defaults to easy difficulty", async () => {
      service.getNewPuzzle.mockResolvedValue(puzzle);
      const res = await server.get("/sudoku/new");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(puzzle);
      expect(service.getNewPuzzle).toHaveBeenCalledWith(undefined, {
        difficulty: "easy",
      });
    });

    it.each(["beginner", "medium", "hard", "impossible"])(
      "passes the requested difficulty (%s)",
      async (difficulty) => {
        service.getNewPuzzle.mockResolvedValue(puzzle);
        await server.get(`/sudoku/new?difficulty=${difficulty}`);
        expect(service.getNewPuzzle).toHaveBeenCalledWith(undefined, {
          difficulty,
        });
      },
    );

    it("does not authenticate, so requests are anonymous even with a token", async () => {
      service.getNewPuzzle.mockResolvedValue(puzzle);
      await server.get("/sudoku/new", auth);
      expect(service.getNewPuzzle).toHaveBeenCalledWith(undefined, {
        difficulty: "easy",
      });
    });

    it("responds 400 for an invalid difficulty", async () => {
      const res = await server.get("/sudoku/new?difficulty=expert");
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "validation_failed",
        issues: [{ path: "(root)", message: "Invalid difficulty" }],
      });
      expect(service.getNewPuzzle).not.toHaveBeenCalled();
    });

    it("forwards service errors to the error handler", async () => {
      service.getNewPuzzle.mockRejectedValue(new Error("boom"));
      const res = await server.get("/sudoku/new");
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "internal_error",
        message: "boom",
      });
    });
  });

  describe("GET /:puzzleId", () => {
    it("requires authentication", async () => {
      const res = await server.get(`/sudoku/${PUZZLE_ID}`);
      expect(res.status).toBe(401);
      expect(service.getUserPuzzle).not.toHaveBeenCalled();
    });

    it("returns the user's puzzle", async () => {
      const up = buildUserPuzzle();
      service.getUserPuzzle.mockResolvedValue(up);
      const res = await server.get(`/sudoku/${PUZZLE_ID}`, auth);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(up);
      expect(service.getUserPuzzle).toHaveBeenCalledWith(USER_ID, PUZZLE_ID);
    });

    it("responds 400 for a non-uuid id", async () => {
      const res = await server.get("/sudoku/not-a-uuid", auth);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        issues: [expect.objectContaining({ path: "puzzleId" })],
      });
    });

    it("responds 404 when the puzzle does not exist", async () => {
      service.getUserPuzzle.mockRejectedValue(new NotFoundError("missing"));
      const res = await server.get(`/sudoku/${PUZZLE_ID}`, auth);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:puzzleId", () => {
    const body = buildUserPuzzle();

    it("requires authentication", async () => {
      const res = await server.put(`/sudoku/${PUZZLE_ID}`, body);
      expect(res.status).toBe(401);
    });

    it("updates the puzzle and responds 204", async () => {
      service.updateUserPuzzle.mockResolvedValue(1);
      const res = await server.put(`/sudoku/${PUZZLE_ID}`, body, auth);
      expect(res.status).toBe(204);
      expect(service.updateUserPuzzle).toHaveBeenCalledWith(USER_ID, body);
    });

    it("uses the puzzle id from the body rather than the path", async () => {
      service.updateUserPuzzle.mockResolvedValue(1);
      await server.put("/sudoku/anything", body, auth);
      expect(service.updateUserPuzzle.mock.calls[0][1].puzzleId).toBe(
        PUZZLE_ID,
      );
    });

    it("responds 400 for an invalid body", async () => {
      const res = await server.put(
        `/sudoku/${PUZZLE_ID}`,
        { ...body, cells: "123" },
        auth,
      );
      expect(res.status).toBe(400);
      expect(service.updateUserPuzzle).not.toHaveBeenCalled();
    });

    it.each([0, 2])("responds 500 when %i rows were updated", async (count) => {
      service.updateUserPuzzle.mockResolvedValue(count);
      const res = await server.put(`/sudoku/${PUZZLE_ID}`, body, auth);
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        message: `Expected to update 1, instead updated: ${count}`,
      });
    });

    it("forwards service errors", async () => {
      service.updateUserPuzzle.mockRejectedValue(new DatabaseError("down"));
      const res = await server.put(`/sudoku/${PUZZLE_ID}`, body, auth);
      expect(res.status).toBe(500);
    });
  });
});
