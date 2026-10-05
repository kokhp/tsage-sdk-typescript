/**
 * Quick TTS example: synthesize text and write mp3 to disk.
 *
 * Usage:
 *   TSAGE_API_KEY=tsa_live_... tsx examples/tts-hello.ts
 */
import { writeFileSync } from "node:fs";
import { TsageClient } from "../src/index.js";

async function main() {
  const apiKey = process.env.TSAGE_API_KEY;
  if (!apiKey) {
    console.error("Set TSAGE_API_KEY env var");
    process.exit(1);
  }

  const client = new TsageClient({ apiKey });
  const audio = await client.tts.synthesizeBytes({
    text: "Hello from TranslatorSage.",
    voiceId: "default",
    lang: "en",
  });
  writeFileSync("hello.mp3", audio);
  console.log(`wrote hello.mp3 (${audio.byteLength} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
