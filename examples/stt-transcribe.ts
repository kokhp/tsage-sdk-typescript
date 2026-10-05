/**
 * Transcribe a local audio file.
 *
 * Usage:
 *   TSAGE_API_KEY=tsa_live_... tsx examples/stt-transcribe.ts recording.wav
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { TsageClient } from "../src/index.js";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: stt-transcribe.ts <audio-file>");
    process.exit(1);
  }
  const client = new TsageClient({ apiKey: process.env.TSAGE_API_KEY! });
  const audio = readFileSync(path);
  const resp = await client.stt.transcribe({
    audio: new Uint8Array(audio),
    filename: basename(path),
    model: "standard",
  });
  console.log(resp.text ?? resp);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
