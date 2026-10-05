import { describe, it, expect } from "vitest";
import { TsageClient } from "../src/index.js";
import { API_KEY, BASE_URL, installFetch, mockResponse } from "./helpers.js";

describe("Consumers", () => {
  it("signup is unauthenticated", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          consumer_id: "c_1",
          email: "x@example.com",
          referral_code: "r_1",
          balance_micros: 2_000_000,
          balance_usd: 2.0,
          api_key: "tsa_live_xxx",
          api_key_id: "ak_1",
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: null, baseUrl: BASE_URL, fetch: impl });
    const out = await client.consumers.signup({ email: "x@example.com" });
    expect(out.api_key).toBe("tsa_live_xxx");
    expect(calls[0].headers.authorization).toBeUndefined();
  });

  it("me returns profile", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          consumer_id: "c_1",
          email: "x@example.com",
          referral_code: "r_1",
          balance_micros: 1_500_000,
          balance_usd: 1.5,
          welcome_gift_claimed: true,
          api_key_count: 1,
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const me = await client.consumers.me();
    expect(me.balance_usd).toBe(1.5);
    expect(calls[0].headers.authorization).toBe(`Bearer ${API_KEY}`);
  });

  it("createApiKey posts a body", async () => {
    const { impl, calls } = installFetch([
      mockResponse({
        body: {
          id: "ak_2",
          name: "ci",
          prefix: "tsa_live_abc",
          plaintext: "tsa_live_abc...zzz",
        },
      }),
    ]);
    const client = new TsageClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: impl });
    const out = await client.consumers.createApiKey({ name: "ci", concurrentLimit: 4 });
    expect(out.id).toBe("ak_2");
    expect(calls[0].body).toMatchObject({ name: "ci", concurrent_limit: 4 });
  });
});
