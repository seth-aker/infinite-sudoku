import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import { requestIdSetter } from "@/core/middleware/requestIdSetter";
import { mockNext, mockRequest, mockResponse } from "#test/helpers/express";
import { startServer, type TestServer } from "#test/helpers/http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("requestIdSetter", () => {
  let server: TestServer;

  // A real Express app, so the tests check the header the client receives
  // and the id later handlers see, not how the middleware sets them.
  beforeAll(async () => {
    const app = express();
    app.use(requestIdSetter);
    app.get("/", (req, res) => {
      res.json({ id: req.id });
    });
    server = await startServer(app);
  });

  afterAll(async () => {
    await server.close();
  });

  async function run(headers: Record<string, string> = {}) {
    const res = await server.get("/", headers);
    const { id } = (await res.json()) as { id: string };
    return { id, header: res.headers.get("x-request-id") };
  }

  it("generates a uuid when no inbound id is present", async () => {
    const { id, header } = await run();
    expect(id).toMatch(UUID_RE);
    expect(header).toBe(id);
  });

  it("generates unique ids per request", async () => {
    expect((await run()).id).not.toBe((await run()).id);
  });

  it.each(["abc-123", "A", "a".repeat(64), "UPPER-lower-0123"])(
    "reuses a safe inbound id (%s)",
    async (inbound) => {
      const { id, header } = await run({ "x-request-id": inbound });
      expect(id).toBe(inbound);
      expect(header).toBe(inbound);
    },
  );

  it.each([
    ["too long", "a".repeat(65)],
    ["empty", ""],
    ["with spaces", "abc 123"],
    ["with underscores", "abc_123"],
    ["with slashes", "../etc"],
  ])("replaces an unsafe inbound id (%s)", async (_label, inbound) => {
    const { id, header } = await run({ "x-request-id": inbound });
    expect(id).toMatch(UUID_RE);
    expect(header).toBe(id);
  });

  // fetch won't send these, so call the middleware directly and check only
  // the id it assigns.
  it.each([
    ["with header injection characters", "abc\r\nset-cookie: x"],
    ["with a trailing newline", "abc\n"],
  ])("replaces an unsafe inbound id (%s)", (_label, inbound) => {
    const req = mockRequest<Request>({ headers: { "x-request-id": inbound } });
    requestIdSetter(req, mockResponse(), mockNext());
    expect(req.id).toMatch(UUID_RE);
  });
});
