import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/config";
import * as baseService from "@/services/baseService";
import {
  getNewPuzzle,
  getSavedProgress,
  saveProgress,
  type SudokuProgressState,
  type UpdateProgressDTO,
  type UserPuzzleDto,
} from "@/services/sudokuService";
import type { Action, Cell } from "@/stores/gameStore";
import { createBlankCells } from "@/utils/puzzleUtils";

// Only the network boundary is mocked; serialization runs for real so these
// tests check the exact strings that go over the wire.
vi.mock("@/services/baseService", () => ({
  safeFetch: vi.fn(),
}));

const safeFetch = vi.mocked(baseService.safeFetch);
const BASE_URL = config.API_BASE_URL;

// 81-character puzzle string: 5 in the first cell, 9 in the last, blanks elsewhere.
const PUZZLE_STRING = "5" + "0".repeat(79) + "9";

function boardCells(): Cell[] {
  const cells = createBlankCells();
  cells[0] = { idx: 0, value: 5, candidates: [] };
  cells[1] = { idx: 1, value: 0, candidates: [2, 7] };
  cells[80] = { idx: 80, value: 9, candidates: [] };
  return cells;
}

function sampleHistory(): Action[] {
  return [
    // binary representation: 100000000001000001010
    { isParent: true, cell: { idx: 10, value: 4, candidates: [] } },
    // binary representation: 010000100100000001011
    { isParent: false, cell: { idx: 11, value: 0, candidates: [1, 4, 9] } },
  ];
}
function encodedSampleHistory(): number[] {
  return [1049098, 542731];
}

function sampleProgress(
  overrides: Partial<SudokuProgressState> = {},
): SudokuProgressState {
  return {
    puzzleId: "puzzle-1",
    cells: boardCells(),
    history: sampleHistory(),
    elapsedSeconds: 125,
    isSolved: false,
    ...overrides,
  };
}

function lastRequest() {
  const [url, init] = safeFetch.mock.calls.at(-1)!;
  return { url, init: init! };
}

function sentBody(): UpdateProgressDTO {
  return JSON.parse(lastRequest().init.body as string);
}

describe("sudokuService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNewPuzzle", () => {
    it("requests a puzzle of the given difficulty with credentials", async () => {
      safeFetch.mockResolvedValue({ success: false, status: 500 });

      await getNewPuzzle("hard");

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/sudoku/new?difficulty=hard`);
      expect(init.method).toBe("GET");
      expect(init.credentials).toBe("include");
    });

    it("maps the response into cells and difficulty fields", async () => {
      safeFetch.mockResolvedValue({
        success: true,
        status: 200,
        body: {
          puzzleId: "puzzle-1",
          cells: PUZZLE_STRING,
          rating: "medium",
          score: 250,
        },
      });

      const result = await getNewPuzzle("medium");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.status).toBe(200);
      const { cells, ...rest } = result.body!;
      expect(rest).toEqual({
        puzzleId: "puzzle-1",
        difficultyRating: "medium",
        difficultyScore: 250,
      });
      expect(cells).toHaveLength(81);
      expect(cells[0]).toEqual({ idx: 0, value: 5, candidates: [] });
      expect(cells[40]).toEqual({ idx: 40, value: 0, candidates: [] });
      expect(cells[80]).toEqual({ idx: 80, value: 9, candidates: [] });
    });

    it("passes a failed request through unchanged", async () => {
      const failure = { success: false as const, status: 429, error: "Slow down" };
      safeFetch.mockResolvedValue(failure);

      expect(await getNewPuzzle("easy")).toEqual(failure);
    });

    it("fails when the response has no body", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 200, body: undefined });

      expect(await getNewPuzzle("easy")).toEqual({
        success: false,
        status: 500,
        error: "Puzzle not received",
      });
    });
  });

  describe("saveProgress", () => {
    it("PUTs to the puzzle's URL with credentials", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 204 });

      await saveProgress(sampleProgress());

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/sudoku/puzzle-1`);
      expect(init.method).toBe("PUT");
      expect(init.credentials).toBe("include");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("sends the board, candidates, actions, time and completion state", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 204 });

      await saveProgress(sampleProgress({ elapsedSeconds: 321, isSolved: true }));

      const body = sentBody();
      expect(body.puzzleId).toBe("puzzle-1");
      expect(body.cells).toBe(PUZZLE_STRING);
      // One ':'-separated entry per cell; only cell 1 has candidates.
      const candidates = body.candidates.split(":");
      expect(candidates).toHaveLength(81);
      expect(candidates[1]).toBe("27");
      expect(candidates.filter((c) => c !== "")).toEqual(["27"]);
      expect(body.actions).toHaveLength(2);
      expect(body.actions).toEqual(encodedSampleHistory())
      expect(body.time).toBe(321);
      expect(body.isCompleted).toBe(true);
    });

    it("sends exactly the fields the server expects", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 204 });

      await saveProgress(sampleProgress({ keepAlive: true }));

      expect(Object.keys(sentBody()).sort()).toEqual(
        ["actions", "candidates", "cells", "isCompleted", "puzzleId", "time"].sort(),
      );
    });

    it("sets keepalive only when asked to", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 204 });

      await saveProgress(sampleProgress({ keepAlive: true }));
      expect(lastRequest().init.keepalive).toBe(true);

      await saveProgress(sampleProgress());
      expect(lastRequest().init.keepalive).toBeFalsy();
    });

    it("sends an empty action list when there is no history", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 204 });

      await saveProgress(sampleProgress({ history: [] }));

      expect(sentBody().actions).toEqual([]);
    });

    it("returns the fetch result unchanged", async () => {
      const failure = { success: false as const, status: 500, error: "boom" };
      safeFetch.mockResolvedValue(failure);

      expect(await saveProgress(sampleProgress())).toEqual(failure);
    });
  });

  describe("getSavedProgress", () => {
    function savedDto(overrides: Partial<UserPuzzleDto> = {}): UserPuzzleDto {
      const candidates = Array(81).fill("");
      candidates[1] = "27";
      return {
        puzzleId: "puzzle-1",
        isCompleted: false,
        cells: PUZZLE_STRING,
        candidates: candidates.join(":"),
        time: 125,
        originalCells: "5" + "0".repeat(80),
        rating: "hard",
        score: 400,
        actions: [],
        ...overrides,
      };
    }

    it("requests the puzzle by id with credentials", async () => {
      safeFetch.mockResolvedValue({ success: false, status: 404 });

      await getSavedProgress("puzzle-1");

      const { url, init } = lastRequest();
      expect(url).toBe(`${BASE_URL}/sudoku/puzzle-1`);
      expect(init.method).toBe("GET");
      expect(init.credentials).toBe("include");
    });

    it("maps the response into the saved game", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 200, body: savedDto() });

      const result = await getSavedProgress("puzzle-1");

      expect(result.success).toBe(true);
      if (!result.success) return;
      const body = result.body!;
      expect(body.puzzleId).toBe("puzzle-1");
      expect(body.elapsedSeconds).toBe(125);
      expect(body.difficultyRating).toBe("hard");
      expect(body.difficultyScore).toBe(400);
      expect(body.cells).toEqual(boardCells());
    });

    it("keeps the original puzzle separate from the current board", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 200, body: savedDto() });

      const result = await getSavedProgress("puzzle-1");

      if (!result.success) throw new Error("expected success");
      const { cells, originalCells } = result.body!;
      expect(originalCells).toHaveLength(81);
      expect(originalCells[0]).toEqual({ idx: 0, value: 5, candidates: [] });
      // The 9 was placed by the player, so it is not part of the original puzzle.
      expect(originalCells[80].value).toBe(0);
      expect(cells[80].value).toBe(9);
      expect(originalCells.every((c) => c.candidates.length === 0)).toBe(true);
    });

    it("decodes the saved actions", async () => {
      // Encode through saveProgress so the test does not hardcode the bit layout.
      safeFetch.mockResolvedValue({ success: true, status: 204 });
      await saveProgress(sampleProgress());
      const encoded = sentBody().actions;

      safeFetch.mockResolvedValue({
        success: true,
        status: 200,
        body: savedDto({ actions: encoded }),
      });
      const result = await getSavedProgress("puzzle-1");

      if (!result.success) throw new Error("expected success");
      expect(result.body!.actions).toEqual(sampleHistory());
    });

    it("returns no actions when the response omits them", async () => {
      safeFetch.mockResolvedValue({
        success: true,
        status: 200,
        body: savedDto({ actions: undefined }),
      });

      const result = await getSavedProgress("puzzle-1");

      if (!result.success) throw new Error("expected success");
      expect(result.body!.actions).toEqual([]);
    });

    it("passes a failed request through unchanged", async () => {
      const failure = { success: false as const, status: 404, error: "Not found" };
      safeFetch.mockResolvedValue(failure);

      expect(await getSavedProgress("puzzle-1")).toEqual(failure);
    });

    it("fails when the response has no body", async () => {
      safeFetch.mockResolvedValue({ success: true, status: 200, body: undefined });

      expect(await getSavedProgress("puzzle-1")).toEqual({
        success: false,
        status: 500,
        error: "Failed to get progress",
      });
    });
  });

  describe("save and load round trip", () => {
    it("restores the same board, history and time that were saved", async () => {
      const progress = sampleProgress({ elapsedSeconds: 999 });
      safeFetch.mockResolvedValue({ success: true, status: 204 });
      await saveProgress(progress);
      const sent = sentBody();

      // Echo what was saved back the way the server would return it.
      safeFetch.mockResolvedValue({
        success: true,
        status: 200,
        body: {
          puzzleId: sent.puzzleId,
          isCompleted: sent.isCompleted,
          cells: sent.cells,
          candidates: sent.candidates,
          time: sent.time,
          actions: sent.actions,
          originalCells: PUZZLE_STRING,
          rating: "easy",
          score: 100,
        } satisfies UserPuzzleDto,
      });
      const result = await getSavedProgress("puzzle-1");

      if (!result.success) throw new Error("expected success");
      expect(result.body!.cells).toEqual(progress.cells);
      expect(result.body!.actions).toEqual(progress.history);
      expect(result.body!.elapsedSeconds).toBe(999);
    });
  });
});
