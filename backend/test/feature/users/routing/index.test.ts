import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sql: { fake: "sql" },
  dataSource: { name: "ds" },
  service: { name: "service" },
  router: { name: "router" },
  createDataSource: vi.fn(),
  createService: vi.fn(),
  UserRouter: vi.fn(),
}));

vi.mock("@/core/dataSource/postgres", () => ({ default: h.sql }));
vi.mock("@/feature/users/datasource/pgUserDataSource", () => ({
  PgUserDataSource: { create: h.createDataSource },
}));
vi.mock("@/feature/users/service/userServiceImplementation", () => ({
  UserServiceImplementation: { create: h.createService },
}));
vi.mock("@/feature/users/routing/userRouter", () => ({
  UserRouter: h.UserRouter,
}));

describe("users routing index", () => {
  it("wires the data source, service and router together", async () => {
    h.createDataSource.mockReturnValue(h.dataSource);
    h.createService.mockReturnValue(h.service);
    h.UserRouter.mockReturnValue(h.router);

    const { userRouter } = await import("@/feature/users/routing/index");

    expect(h.createDataSource).toHaveBeenCalledWith(h.sql);
    expect(h.createService).toHaveBeenCalledWith(h.dataSource);
    expect(h.UserRouter).toHaveBeenCalledWith(h.service);
    expect(userRouter).toBe(h.router);
  });
});
