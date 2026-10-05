import { describe, it, expect } from "vitest";
import { TsageClient } from "../src/index.js";
import { API_KEY, BASE_URL, installFetch, mockResponse } from "./helpers.js";

describe("Voices", () => {
  it("lists voices", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: [
          {
            voice_id: "v1",
            name: "preset-1",
            type: "preset",
            visibility: "library",
            lang_support: ["en"],
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const voices = await client.voices.list();
    expect(voices).toHaveLength(1);
    expect(voices[0].voice_id).toBe("v1");
    expect(calls[0].url).toBe(`${BASE_URL}/v1/voices`);
  });

  it("adds an IVC voice from URL", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          voice_id: "ivc_1",
          name: "my-voice",
          type: "ivc",
          visibility: "private",
          lang_support: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const v = await client.voices.add({
      name: "my-voice",
      referenceAudioUrl: "https://ex/ref.wav",
    });
    expect(v.voice_id).toBe("ivc_1");
    expect(calls[0].body).toMatchObject({
      name: "my-voice",
      reference_audio_url: "https://ex/ref.wav",
    });
  });

  it("promotes to PVC", async () => {
    const { impl, calls } = installFetch([mockResponse({ body: { ok: true } })]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await client.voices.promoteToPvc("v_1");
    expect(calls[0].url).toBe(`${BASE_URL}/v1/voices/v_1/professional`);
    expect(calls[0].method).toBe("POST");
  });

  it("deletes a voice", async () => {
    const { impl, calls } = installFetch([mockResponse({ body: { ok: true } })]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    await client.voices.delete("v_1");
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe(`${BASE_URL}/v1/voices/v_1`);
  });
});
