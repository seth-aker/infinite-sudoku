import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reauthenticate, safeFetch } from "@/services/baseService";

const input = "http://test.com/resource";
const REFRESH_URL = expect.stringContaining("/auth/web/refresh");
const mockFetch = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function textResponse(status: number, body = "plain text") {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

function refreshCallCount() {
  return mockFetch.mock.calls.filter(([url]) =>
    String(url).includes("/auth/web/refresh"),
  ).length;
}

describe("BaseService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("safeFetch", () => {
    it("passes input and init through to fetch", async () => {
      mockFetch.mockResolvedValue(jsonResponse(200));
      const init: RequestInit = { method: "PUT", body: "payload" };

      await safeFetch(input, init);

      expect(mockFetch).toHaveBeenCalledExactlyOnceWith(input, init);
    });

    describe("when response.ok is true", () => {
      it("returns the parsed body when content-type is application/json", async () => {
        mockFetch.mockResolvedValue(jsonResponse(200, { id: 7, name: "puzzle" }));

        const result = await safeFetch(input);

        expect(result).toEqual({
          success: true,
          body: { id: 7, name: "puzzle" },
          status: 200,
        });
      });

      it("returns an undefined body when content-type is not JSON", async () => {
        mockFetch.mockResolvedValue(textResponse(200));

        const result = await safeFetch(input);

        expect(result).toEqual({ success: true, body: undefined, status: 200 });
      });

      it("returns an undefined body when a JSON response is malformed", async () => {
        mockFetch.mockResolvedValue(
          new Response("{not json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );

        const result = await safeFetch(input);

        expect(result).toEqual({ success: true, body: undefined, status: 200 });
      });
    });

    describe("when response.ok is false", () => {
      it("returns the body's message as the error when content-type is application/json", async () => {
        mockFetch.mockResolvedValue(
          jsonResponse(400, { error: "Bad Request", message: "invalid cell", requestId: "abc" }),
        );

        const result = await safeFetch(input);

        expect(result).toEqual({ success: false, error: "invalid cell", status: 400 });
      });

      it("returns an undefined error when content-type is not JSON", async () => {
        mockFetch.mockResolvedValue(textResponse(500, "Internal Server Error"));

        const result = await safeFetch(input);

        expect(result).toEqual({ success: false, error: undefined, status: 500 });
      });
    });

    it("returns a 500 failure when fetch rejects", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      const result = await safeFetch(input);

      expect(result).toEqual({
        success: false,
        error: "TypeError: Failed to fetch",
        status: 500,
      });
    });

    describe("when response status is 401", () => {
      it("refreshes the session and retries the original request", async () => {
        mockFetch
          .mockResolvedValueOnce(jsonResponse(401))
          .mockResolvedValueOnce(jsonResponse(200)) // refresh
          .mockResolvedValueOnce(jsonResponse(200, { ok: true })); // retry
        const init: RequestInit = { method: "GET" };

        const result = await safeFetch(input, init);

        expect(result).toEqual({ success: true, body: { ok: true }, status: 200 });
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockFetch).toHaveBeenNthCalledWith(1, input, init);
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          REFRESH_URL,
          expect.objectContaining({ method: "POST", credentials: "include" }),
        );
        expect(mockFetch).toHaveBeenNthCalledWith(3, input, init);
      });

      it("returns the refresh error when the refresh fails", async () => {
        mockFetch
          .mockResolvedValueOnce(jsonResponse(401))
          .mockResolvedValueOnce(jsonResponse(403, { error: "refresh token revoked" }));

        const result = await safeFetch(input);

        expect(result).toEqual({
          success: false,
          error: "refresh token revoked",
          status: 403,
        });
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it("falls back to a session-expired message when the refresh fails without an error", async () => {
        mockFetch
          .mockResolvedValueOnce(jsonResponse(401))
          .mockResolvedValueOnce(textResponse(401));

        const result = await safeFetch(input);

        expect(result).toEqual({
          success: false,
          error: "Session expired, please log in again.",
          status: 401,
        });
      });

      it("does not refresh again when the retried request also returns 401", async () => {
        mockFetch
          .mockResolvedValueOnce(jsonResponse(401))
          .mockResolvedValueOnce(jsonResponse(200)) // refresh
          .mockResolvedValueOnce(jsonResponse(401, { message: "still unauthorized" }));

        const result = await safeFetch(input);

        expect(result).toEqual({
          success: false,
          error: "still unauthorized",
          status: 401,
        });
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(refreshCallCount()).toBe(1);
      });

      it("shares a single refresh between concurrent 401 responses", async () => {
        let resolveRefresh!: (res: Response) => void;
        const refreshResponse = new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
        const attempts = new Map<string, number>();
        mockFetch.mockImplementation((url) => {
          const key = String(url);
          if (key.includes("/auth/web/refresh")) return refreshResponse;
          const attempt = (attempts.get(key) ?? 0) + 1;
          attempts.set(key, attempt);
          return Promise.resolve(
            attempt === 1 ? jsonResponse(401) : jsonResponse(200, { url: key }),
          );
        });

        const pending = Promise.all([safeFetch("http://test.com/a"), safeFetch("http://test.com/b")]);
        // Let both requests receive their 401 before the refresh resolves.
        await vi.waitFor(() => expect(refreshCallCount()).toBe(1));
        resolveRefresh(jsonResponse(200));
        const [a, b] = await pending;

        expect(a).toEqual({ success: true, body: { url: "http://test.com/a" }, status: 200 });
        expect(b).toEqual({ success: true, body: { url: "http://test.com/b" }, status: 200 });
        expect(refreshCallCount()).toBe(1);
      });
    });
  });

  describe("reauthenticate", () => {
    it("POSTs to the refresh endpoint with credentials", async () => {
      mockFetch.mockResolvedValue(jsonResponse(200));

      await reauthenticate();

      expect(mockFetch).toHaveBeenCalledExactlyOnceWith(REFRESH_URL, {
        method: "POST",
        credentials: "include",
      });
    });

    it("returns success when response.ok is true", async () => {
      mockFetch.mockResolvedValue(jsonResponse(200));

      const result = await reauthenticate();

      expect(result).toEqual({ success: true, status: 200 });
    });

    it("returns the body's error field when the response is a JSON failure", async () => {
      mockFetch.mockResolvedValue(jsonResponse(403, { error: "error" }));

      const result = await reauthenticate();

      expect(result).toEqual({ success: false, status: 403, error: "error" });
    });

    it("returns an undefined error when the JSON failure has no error field", async () => {
      mockFetch.mockResolvedValue(jsonResponse(401, { message: "error" }));

      const result = await reauthenticate();

      expect(result).toEqual({ success: false, status: 401, error: undefined });
    });

    it("returns an undefined error when content-type is not JSON", async () => {
      mockFetch.mockResolvedValue(textResponse(401));

      const result = await reauthenticate();

      expect(result).toEqual({ success: false, status: 401, error: undefined });
    });

    it("returns a 500 failure when fetch rejects", async () => {
      mockFetch.mockRejectedValue(new Error("mock error"));

      const result = await reauthenticate();

      expect(result).toEqual({
        success: false,
        error: "Error: mock error",
        status: 500,
      });
    });
  });
});
