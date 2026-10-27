import express, { type Express, type Router } from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { requestIdSetter } from "@/core/middleware/requestIdSetter";
import { notFoundHandler } from "@/core/middleware/notfoundHandler";
import { errorHandler } from "@/core/middleware/errorHandler";

export interface TestServer {
  baseUrl: string;
  server: Server;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  get: (path: string, headers?: Record<string, string>) => Promise<Response>;
  post: (
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  put: (
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  close: () => Promise<void>;
}

export function buildApp(mountPath: string, router: Router): Express {
  const app = express();
  app.use(requestIdSetter);
  app.use(express.json());
  app.use(cookieParser());
  app.use(mountPath, router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export async function startServer(app: Express): Promise<TestServer> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return wrapServer(server);
}

export function wrapServer(server: Server): TestServer {
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const request = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}${path}`, init);
  const withBody =
    (method: string) =>
    (path: string, body?: unknown, headers: Record<string, string> = {}) =>
      request(path, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  return {
    baseUrl,
    server,
    request,
    get: (path, headers = {}) => request(path, { headers }),
    post: withBody("POST"),
    put: withBody("PUT"),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
