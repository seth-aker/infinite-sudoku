import { vi, type Mock } from "vitest";
import type { NextFunction, Request, Response } from "express";

export interface MockRequestInit {
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  cookies?: Record<string, string>;
  [key: string]: unknown;
}

export function mockRequest<T = Request>(init: MockRequestInit = {}): T {
  const headers = Object.fromEntries(
    Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    method: "GET",
    originalUrl: "/",
    ip: "127.0.0.1",
    body: {},
    params: {},
    query: {},
    cookies: {},
    ...init,
    headers,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as T;
}

export type MockResponse = Response & {
  status: Mock;
  json: Mock;
  send: Mock;
  sendStatus: Mock;
  setHeader: Mock;
  cookie: Mock;
  clearCookie: Mock;
};

export function mockResponse(init: Partial<Response> = {}): MockResponse {
  const res = { headersSent: false, ...init } as MockResponse;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.sendStatus = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  res.clearCookie = vi.fn(() => res);
  return res;
}

export function mockNext(): NextFunction & Mock {
  return vi.fn() as NextFunction & Mock;
}
