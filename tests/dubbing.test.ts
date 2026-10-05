import { describe, it, expect } from "vitest";
import { TsageClient, TsageNotFoundError } from "../src/index.js";
import { API_KEY, BASE_URL, installFetch, mockResponse } from "./helpers.js";

describe("Dubbing", () => {
  it("create posts the body", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          job_id: "job_1",
          status: "queued",
          target_lang: "es",
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const job = await client.dubbing.create({
      sourceUrl: "https://ex/clip.mp4",
      targetLang: "es",
    });
    expect(job.job_id).toBe("job_1");
    expect(calls[0].body).toMatchObject({
      source_url: "https://ex/clip.mp4",
      target_lang: "es",
      watermark: true,
    });
  });

  it("videoUrl aliases sourceUrl", async () => {
    const { impl, calls } = installFetch([
      mockResponse({ body: { job_id: "j", status: "queued", target_lang: "fr" } }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await client.dubbing.create({ videoUrl: "https://ex/v.mp4", targetLang: "fr" });
    expect((calls[0].body as any).source_url).toBe("https://ex/v.mp4");
  });

  it("get returns job status", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          job_id: "job_1",
          status: "succeeded",
          target_lang: "es",
          audio_url: "https://cdn/a.mp3",
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const job = await client.dubbing.get("job_1");
    expect(job.status).toBe("succeeded");
    expect(calls[0].url).toBe(`${BASE_URL}/v1/dubbing/job_1`);
  });

  it("get 404 raises TsageNotFoundError", async () => {
    const { impl } = installFetch([
      mockResponse({ status: 404, body: { detail: "not_found" } }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await expect(client.dubbing.get("nope")).rejects.toBeInstanceOf(
      TsageNotFoundError,
    );
  });

  it("wait polls until succeeded", async () => {
    const { impl } = installFetch([
      mockResponse({ body: { job_id: "j", status: "running", target_lang: "es" } }),
      mockResponse({ body: { job_id: "j", status: "running", target_lang: "es" } }),
      mockResponse({
        body: {
          job_id: "j",
          status: "succeeded",
          target_lang: "es",
          audio_url: "https://cdn/x.mp3",
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const final = await client.dubbing.wait("j", { pollIntervalMs: 1 });
    expect(final.status).toBe("succeeded");
  });

  it("wait times out", async () => {
    const { impl } = installFetch(() =>
      mockResponse({
        body: { job_id: "j", status: "running", target_lang: "es" },
      }),
    );
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await expect(
      client.dubbing.wait("j", { pollIntervalMs: 1, timeoutMs: 20 }),
    ).rejects.toThrowError(/terminal state/);
  });
});
