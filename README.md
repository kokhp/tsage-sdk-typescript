# @tsage/sdk — TranslatorSage TypeScript SDK

Official TypeScript / JavaScript client for the
[TranslatorSage](https://translatorsage.com) API: TTS, STT, translation,
dubbing, voice cloning, and the full orchestrator surface at
`https://developers.translatorsage.com`.

Includes a **drop-in ElevenLabs-compatible client** (`@tsage/sdk/elevenlabs-compat`)
so migrating existing code is a two-line change: swap the import and the API
key.

- Zero codegen friction — pure typed `fetch`, works in Node 18+, Bun, Deno, modern browsers, Workers.
- ESM-only, strict TypeScript 5.4+, no runtime dependencies at the user level.
- Mirrors `tsage-sdk-python` namespace-by-namespace for consistent docs.

## Install

```bash
npm install @tsage/sdk
# or
pnpm add @tsage/sdk
# or
yarn add @tsage/sdk
```

## Quick start

```typescript
import { TsageClient } from "@tsage/sdk";

const client = new TsageClient({ apiKey: "tsa_live_..." });

// Text to speech
const resp = await client.tts.synthesize({
  text: "Hello world",
  voiceId: "default",
  lang: "en",
});
// resp = { audio: "<base64 mp3>", units_billed: 0.005, cost_micros: ... }

// Raw audio bytes (base64-decoded)
const audio = await client.tts.synthesizeBytes({ text: "Hello" });

// Speech to text
const tx = await client.stt.transcribe({
  audio: new Uint8Array(await file.arrayBuffer()),
  filename: "rec.wav",
  model: "standard",
});

// Translate
const out = await client.translate.translate({
  text: "Hello",
  targetLang: "es",
});

// Dubbing (async, poll until done)
const job = await client.dubbing.create({
  videoUrl: "https://.../clip.mp4",
  targetLang: "es",
});
const result = await client.dubbing.wait(job.job_id);

// Voices
const voices = await client.voices.list();
const added = await client.voices.add({
  name: "my-voice",
  referenceAudioUrl: "https://.../ref.wav",
});

// Consumers (unauthenticated signup)
const anon = new TsageClient();
const signup = await anon.consumers.signup({ email: "dev@example.com" });
// signup.api_key -> use for subsequent calls
```

## ElevenLabs drop-in replacement

```typescript
// Before (ElevenLabs):
// import { ElevenLabsClient } from "elevenlabs";
// const client = new ElevenLabsClient({ apiKey: "sk_..." });

// After:
import { ElevenLabsCompat } from "@tsage/sdk/elevenlabs-compat";
const client = new ElevenLabsCompat({ apiKey: "tsa_live_..." });

const resp = await client.textToSpeech.convert("default", {
  text: "Hi",
  modelId: "tsage-tts-v1",
});
```

Exposed surface:

- `textToSpeech.convert(voiceId, { text, modelId, voiceSettings, outputFormat })`
- `textToSpeech.convertAsStream(voiceId, { text, ... })` — AsyncIterable chunks
- `speechToText.convert({ file, modelId, languageCode })`
- `voices.getAll()` / `voices.search()` / `voices.add({ name, files })` / `voices.delete(voiceId)`
- `dubbing.create({ sourceUrl, targetLang, name, numSpeakers, watermark })`
- `dubbing.get(dubbingId)` / `dubbing.getAudio(dubbingId)`

Known shape divergences:

- `voices.add({ files })` — upstream accepts local file paths, we require
  hosted audio URLs. Upload the file first (your own S3/R2) and pass the URL.
- No `voice_settings.stability` / `similarity_boost` yet.
- STT `modelId` is translated to the TranslatorSage tier (`scribe_v1` →
  `standard`, `scribe_live` → `live`, `scribe_medical` → `medical`,
  `scribe_raw` → `raw`).

## Error handling

```typescript
import {
  TsageError,
  TsageAuthError,
  TsageInsufficientBalanceError,
  TsageNotFoundError,
  TsageRateLimitError,
  TsageServerError,
  TsageValidationError,
} from "@tsage/sdk";

try {
  await client.tts.synthesize({ text: "x" });
} catch (e) {
  if (e instanceof TsageInsufficientBalanceError) {
    // 402 — top up balance via POST /v1/consumers/me/topup
  } else if (e instanceof TsageRateLimitError) {
    // 429 — exponential backoff
  } else if (e instanceof TsageError) {
    console.error(e.statusCode, e.message, e.requestId);
  }
}
```

## Custom base URL / self-hosted orchestrator

```typescript
const client = new TsageClient({
  apiKey: "tsa_live_...",
  baseUrl: "https://your-orchestrator.example.com",
  timeoutMs: 120_000,
});
```

## Advanced: strongly-typed route schemas

Regenerate the full OpenAPI schema with:

```bash
npm run generate-types
```

That writes `src/_generated/schema.ts` which can be fed to
[`openapi-fetch`](https://openapi-ts.pages.dev/openapi-fetch/) for strict
request/response typing on routes not surfaced by the fluent client yet.

## License

MIT
