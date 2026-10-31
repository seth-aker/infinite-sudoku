import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as baseService from "@/services/baseService";
const safeFetch = baseService.safeFetch;
vi.mock("@/utils/jsonUtils", () => ({
  safeParseJson: vi.fn().mockImplementation((returnValue) => returnValue)
}));
const input = "http://test.com"
const mockFetch = vi.fn();
function setFetchReturnValue(ok: boolean, status: number, isJson: boolean, text?: Object) {
  mockFetch.mockReturnValue({
    ok,
    status,
    text: vi.fn().mockReturnValue(text ?? {}),
    headers: {
      get: vi.fn().mockReturnValue(isJson ? ['application/json'] : [])
    }
  })
}
describe("BaseService", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch;
  })
  afterEach(() => {
    vi.restoreAllMocks();
  })
  describe("safeFetch", () => {
    describe("returns success service result when response.ok is true", () => {
      it("and content-type is application/json", async () => {
        setFetchReturnValue(true, 200, true);
        const result = await safeFetch(input);

        expect(result).toEqual({
          success: true,
          body: {},
          status: 200
        })
      })
      it("and content-type is text", async () => {
        setFetchReturnValue(true, 200, false);
        const result = await safeFetch(input);

        expect(result).toEqual({
          success: true,
          body: undefined,
          status: 200
        })
      })
    })
    describe("returns failure service result when response.ok is false", () => {
      it("and content-type is application/json", async () => {
        setFetchReturnValue(false, 400, true, { message: "error" })
        const result = await safeFetch(input);

        expect(result).toEqual({
          success: false,
          error: "error",
          status: 400
        })
      })
      it("and content-type is text", async () => {
        setFetchReturnValue(false, 400, false, { message: "error" })

        const result = await safeFetch(input);
        expect(result).toEqual({
          success: false,
          error: undefined,
          status: 400,
        })
      })
    })
    describe("when response status is 401", () => {
      it("resolves successfully when reauthenticate returns successfull", async () => {
        const spy = vi.spyOn(baseService, 'reauthenticate')
          .mockResolvedValue({ success: true, status: 200 });
       mockFetch.mockReturnValueOnce({
          status: 401
        }).mockReturnValue({
            ok: true,
            status: 200,
            text: () => "{}",
            headers: {
              get: vi.fn().mockReturnValue([])
            }
          })
        const result = await safeFetch(input);

        expect(result).toEqual({
          success: true,
          status: 200,
          body: undefined
        })

        expect(spy).toHaveBeenCalledOnce()

      })

    })

  })

  describe("reauthenticate", () => {
    it("returns successfully when response.ok is true", async () => {
      setFetchReturnValue(true, 200, true);
      const result = await baseService.reauthenticate();
      expect(result).toEqual({
        success: true,
        status: 200,
      })
    })
    it("returns custom error message when response.ok is false and response has error message", async () => {
      setFetchReturnValue(false, 403, true, { error: 'error' });

      const result = await baseService.reauthenticate();
      expect(result).toEqual({
        success: false,
        status: 403,
        error: 'error'
      })
    })
    it("returns undefined error message when response.ok is false and response does not have error message", async () => {
      setFetchReturnValue(false, 401, true, { message: 'error' })

      const result = await baseService.reauthenticate();
      expect(result).toEqual({
        success: false,
        status: 401,
        error: undefined
      })
    })
    it("returns undefined error message when response.ok is false and content-type is not application/json", async () => {
      setFetchReturnValue(false, 401, false);

      const result = await baseService.reauthenticate();
      expect(result).toEqual({
        success: false,
        status: 401,
        error: undefined
      })
    })
    it("catches errors and returns ServiceResult", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockThrow(new Error("mock error"))
      const result = await baseService.reauthenticate();

      expect(result).toEqual({
        success: false,
        error: "Error: mock error",
        status: 500,
      })
    })
  })
})
