import { describe, it, expect } from "vitest";
import { TsageClient, TsageValidationError } from "../src/index.js";
import { API_KEY, BASE_URL, installFetch, mockResponse } from "./helpers.js";

describe("STT", () => {
  it("transcribes raw bytes via multipart", async () => {
    const { impl, calls } = installFetch([
      mockResponse({ body: { text: "hello world", language: "en" } }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const audio = new Uint8Array([1, 2, 3, 4]);
    const resp = await client.stt.transcribe({ audio });
    expect(resp.text).toBe("hello world");
    expect(calls[0].url).toContain("/v1/speech-to-text");
    expect(calls[0].url).toContain("model=standard");
    expect(calls[0].body).toBeInstanceOf(FormData);
  });

  it("accepts Blob input", async () => {
    const { impl } = installFetch([mockResponse({ body: { text: "ok" } })]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const blob = new Blob([new Uint8Array([0, 1, 2])], { type: "audio/wav" });
    const resp = await client.stt.transcribe({ audio: blob, filename: "foo.wav" });
    expect(resp.text).toBe("ok");
  });

  it("tier switch is reflected in query string", async () => {
    const { impl, calls } = installFetch([
      mockResponse({ body: { text: "live" } }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await client.stt.transcribe({ audio: new Uint8Array([1]), model: "live" });
    expect(calls[0].url).toContain("model=live");
  });

  it("requires audio or audioUrl", async () => {
    const { impl } = installFetch([mockResponse({ body: {} })]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await expect(client.stt.transcribe({})).rejects.toThrowError(/audio/);
  });

  it("422 raises TsageValidationError", async () => {
    const { impl } = installFetch([
      mockResponse({ status: 422, body: { detail: "bad_audio" } }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await expect(
      client.stt.transcribe({ audio: new Uint8Array([1]) }),
    ).rejects.toBeInstanceOf(TsageValidationError);
  });
});
