import type { Express } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

type Headers = Record<string, string>;

export interface TestServer {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  get: (path: string, headers?: Headers) => Promise<Response>;
  post: (path: string, body?: unknown, headers?: Headers) => Promise<Response>;
  close: () => Promise<void>;
}

/**
 * Starts an Express app on a random free port and returns a small client for
 * sending real HTTP requests to it. Call `close()` when the test is done.
 */
export async function startServer(app: Express): Promise<TestServer> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  const request = (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${port}${path}`, init);

  return {
    request,
    get: (path, headers = {}) => request(path, { headers }),
    post: (path, body, headers = {}) =>
      request(path, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
