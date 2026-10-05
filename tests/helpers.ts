import { vi } from "vitest";

export const BASE_URL = "https://api.test.local";
export const API_KEY = "tsa_test_abc";

export interface MockCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockResponseInit {
  status?: number;
  body: unknown;
  isJson?: boolean;
  requestId?: string;
}

/** Build a Response-like object compatible with the fetch Response shape. */
export function mockResponse(init: MockResponseInit): Response {
  const status = init.status ?? 200;
  const isJson = init.isJson ?? true;
  const bodyStr = isJson ? JSON.stringify(init.body) : String(init.body);
  const headers = new Headers({
    "content-type": isJson ? "application/json" : "text/plain",
  });
  if (init.requestId) headers.set("x-request-id", init.requestId);
  return new Response(bodyStr, { status, headers });
}

/** Install a fetch mock that returns one or more sequential responses. */
export function installFetch(sequence: Response[] | ((call: MockCall) => Response)) {
  const calls: MockCall[] = [];
  let i = 0;
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      headers[k.toLowerCase()] = v;
    }
    let body: unknown = undefined;
    if (init?.body) {
      if (typeof init.body === "string") {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = init.body;
        }
      } else {
        body = init.body; // FormData / Blob
      }
    }
    const call = { url, method, headers, body };
    calls.push(call);
    if (typeof sequence === "function") return sequence(call);
    const resp = sequence[Math.min(i, sequence.length - 1)];
    i += 1;
    return resp;
  });
  return { impl, calls };
}
