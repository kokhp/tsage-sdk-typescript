import { describe, it, expect } from "vitest";
import { ElevenLabsCompat } from "../src/elevenlabs-compat.js";
import { API_KEY, BASE_URL, installFetch, mockResponse } from "./helpers.js";

function toB64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

describe("ElevenLabsCompat", () => {
  it("textToSpeech.convert hits /v1/text-to-speech/{voice_id}", async () => {
    const audioB64 = toB64(new TextEncoder().encode("hello audio"));
    const { impl, calls } = installFetch([
      mockResponse({ body: { audio: audioB64 } }),
    ]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const resp = await client.textToSpeech.convert("default", {
      text: "Hi",
      modelId: "tsage-tts-v1",
    });
    expect(resp.audio).toBe(audioB64);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/text-to-speech/default`);
  });

  it("speechToText.convert maps scribe_v1 -> standard tier", async () => {
    const { impl, calls } = installFetch([
      mockResponse({ body: { text: "hi" } }),
    ]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const blob = new Blob([new Uint8Array([1, 2])], { type: "audio/wav" });
    await client.speechToText.convert({ file: blob, modelId: "scribe_v1" });
    expect(calls[0].url).toContain("model=standard");
  });

  it("voices.getAll wraps the list in { voices }", async () => {
    const { impl } = installFetch([
      mockResponse({
        body: [
          {
            voice_id: "v1",
            name: "a",
            type: "preset",
            visibility: "library",
            lang_support: null,
            created_at: "2026-01-01",
          },
        ],
      }),
    ]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const out = await client.voices.getAll();
    expect(out.voices).toHaveLength(1);
  });

  it("voices.add rejects local file paths", async () => {
    const { impl } = installFetch([mockResponse({ body: {} })]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await expect(
      client.voices.add({ name: "x", files: ["/tmp/local.wav"] }),
    ).rejects.toThrowError(/hosted audio URLs/);
  });

  it("voices.add accepts hosted URL", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          voice_id: "v_1",
          name: "x",
          type: "ivc",
          visibility: "private",
          lang_support: null,
          created_at: "2026-01-01",
        },
      }),
    ]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const v: any = await client.voices.add({
      name: "x",
      files: ["https://ex/sample.wav"],
    });
    expect(v.voice_id).toBe("v_1");
    expect(calls[0].body).toMatchObject({ reference_audio_url: "https://ex/sample.wav" });
  });

  it("dubbing.create posts with watermark=true default", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: { job_id: "j", status: "queued", target_lang: "es" },
      }),
    ]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await client.dubbing.create({
      sourceUrl: "https://ex/v.mp4",
      targetLang: "es",
    });
    expect(calls[0].body).toMatchObject({
      source_url: "https://ex/v.mp4",
      target_lang: "es",
      watermark: true,
    });
  });

  it("dubbing.get fetches by id", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          job_id: "j",
          status: "succeeded",
          target_lang: "es",
          audio_url: "https://cdn/a.mp3",
        },
      }),
    ]);
    const client = new ElevenLabsCompat({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const job: any = await client.dubbing.get("j");
    expect(job.status).toBe("succeeded");
    expect(calls[0].url).toBe(`${BASE_URL}/v1/dubbing/j`);
  });
});
