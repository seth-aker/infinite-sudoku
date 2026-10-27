import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sql: { fake: "sql" },
  dataSource: { name: "ds" },
  service: { name: "service" },
  router: { name: "router" },
  createDataSource: vi.fn(),
  createService: vi.fn(),
  SudokuRouter: vi.fn(),
}));

vi.mock("@/core/dataSource/postgres", () => ({ default: h.sql }));
vi.mock("@/feature/sudoku/datasource/pgSudokuDataSource", () => ({
  PgSudokuDataSource: { create: h.createDataSource },
}));
vi.mock("@/feature/sudoku/service/sudokuServiceImplementation", () => ({
  SudokuServiceImplementation: { create: h.createService },
}));
vi.mock("@/feature/sudoku/routing/sudokuRouter", () => ({
  default: h.SudokuRouter,
}));

describe("sudoku routing index", () => {
  it("wires the data source, service and router together", async () => {
    h.createDataSource.mockReturnValue(h.dataSource);
    h.createService.mockReturnValue(h.service);
    h.SudokuRouter.mockReturnValue(h.router);

    const { sudokuRouter } = await import("@/feature/sudoku/routing/index");

    expect(h.createDataSource).toHaveBeenCalledWith(h.sql);
    expect(h.createService).toHaveBeenCalledWith(h.dataSource);
    expect(h.SudokuRouter).toHaveBeenCalledWith(h.service);
    expect(sudokuRouter).toBe(h.router);
  });
});
