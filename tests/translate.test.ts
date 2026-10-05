import { describe, it, expect } from "vitest";
import { TsageClient } from "../src/index.js";
import { API_KEY, BASE_URL, installFetch, mockResponse } from "./helpers.js";

describe("Translate", () => {
  it("translates text", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          translated_text: "Hola",
          source_lang: "en",
          target_lang: "es",
          units_billed: 1,
          cost_micros: 100,
          balance_after_micros: 999_900,
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const out = await client.translate.translate({
      text: "Hello",
      targetLang: "es",
    });
    expect(out.translated_text).toBe("Hola");
    expect(calls[0].url).toBe(`${BASE_URL}/v1/translate`);
    expect(calls[0].body).toMatchObject({ text: "Hello", target_lang: "es" });
  });

  it("text() alias works", async () => {
    const { impl } = installFetch([
      mockResponse({
        body: {
          translated_text: "Bonjour",
          source_lang: "en",
          target_lang: "fr",
          units_billed: 1,
          cost_micros: 100,
          balance_after_micros: 1,
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const out = await client.translate.text({ text: "Hi", targetLang: "fr" });
    expect(out.translated_text).toBe("Bonjour");
  });
});
