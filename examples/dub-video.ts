/**
 * Create a dubbing job and poll until it finishes.
 *
 * Usage:
 *   TSAGE_API_KEY=tsa_live_... tsx examples/dub-video.ts https://ex/clip.mp4 es
 */
import { TsageClient } from "../src/index.js";

async function main() {
  const [videoUrl, targetLang] = process.argv.slice(2);
  if (!videoUrl || !targetLang) {
    console.error("usage: dub-video.ts <video-url> <target-lang>");
    process.exit(1);
  }
  const client = new TsageClient({ apiKey: process.env.TSAGE_API_KEY! });

  const job = await client.dubbing.create({ videoUrl, targetLang });
  console.log("job queued:", job.job_id);
  const final = await client.dubbing.wait(job.job_id);
  console.log("status:", final.status);
  console.log("audio_url:", final.audio_url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
