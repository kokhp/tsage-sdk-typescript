/**
 * Drop-in replacement for the ElevenLabs TypeScript SDK (@elevenlabs/elevenlabs-js, elevenlabs).
 *
 * The upstream SDK's surface (as of elevenlabs@1.x) is:
 *
 *   import { ElevenLabsClient } from "elevenlabs";
 *   const client = new ElevenLabsClient({ apiKey: "sk_el_..." });
 *   await client.textToSpeech.convert(voiceId, { text, modelId });
 *   await client.speechToText.convert({ file, modelId });
 *   await client.voices.getAll();
 *   await client.voices.add({ name, files });
 *   await client.dubbing.create({ sourceUrl, targetLang });
 *   await client.dubbing.get(dubbingId);
 *
 * `ElevenLabsCompat` mirrors these so switching from ElevenLabs is a two-line
 * change: swap the import and the API key / base URL.
 */

import { TsageClient, DEFAULT_BASE_URL } from "./client.js";
import type { TsageClientOptions } from "./client.js";
import type { TTSResponse, STTResponse, VoicePublic } from "./types.js";
import { TsageError } from "./errors.js";

const MODEL_ID_TO_TIER: Record<string, string> = {
  scribe_v1: "standard",
  scribe_standard: "standard",
  scribe_live: "live",
  scribe_medical: "medical",
  scribe_raw: "raw",
};

export interface ElevenLabsCompatOptions extends TsageClientOptions {}

export interface CompatTTSConvertInput {
  text: string;
  modelId?: string;
  voiceSettings?: Record<string, unknown>;
  outputFormat?: string;
}

export interface CompatSTTConvertInput {
  file: Blob | Uint8Array | ArrayBuffer | string;
  modelId?: string;
  languageCode?: string;
}

export interface CompatVoicesAddInput {
  name: string;
  /** ElevenLabs accepts local file paths; we require hosted URL strings. */
  files: string[];
  description?: string;
  labels?: Record<string, unknown>;
}

export interface CompatDubbingCreateInput {
  sourceUrl?: string;
  targetLang: string;
  name?: string;
  numSpeakers?: number;
  watermark?: boolean;
}

class CompatTextToSpeech {
  constructor(private readonly inner: TsageClient) {}

  /**
   * Mirror ElevenLabs' `.textToSpeech.convert(voiceId, { text, modelId })`.
   * Returns the full response JSON (including base64 `audio` field).
   *
   * To get an async-iterable of audio chunks like ElevenLabs returns, use
   * `.convertAsStream(voiceId, { text })` below.
   */
  async convert(voiceId: string, input: CompatTTSConvertInput): Promise<TTSResponse> {
    return this.inner.tts.synthesize({
      voiceId,
      text: input.text,
      modelId: input.modelId ?? "tsage-tts-v1",
      voiceSettings: input.voiceSettings ?? null,
      outputFormat: input.outputFormat ?? "mp3_44100_128",
    });
  }

  convertAsStream(
    voiceId: string,
    input: CompatTTSConvertInput,
  ): AsyncIterable<Uint8Array> {
    return this.inner.tts.stream({
      voiceId,
      text: input.text,
      modelId: input.modelId ?? "tsage-tts-v1",
      voiceSettings: input.voiceSettings ?? null,
      outputFormat: input.outputFormat ?? "mp3_44100_128",
    });
  }
}

class CompatSpeechToText {
  constructor(private readonly inner: TsageClient) {}

  async convert(input: CompatSTTConvertInput): Promise<STTResponse> {
    const tier = MODEL_ID_TO_TIER[input.modelId ?? ""] ?? "standard";
    // Accept URL strings for parity with ElevenLabs' flexible file arg.
    if (typeof input.file === "string" && /^https?:\/\//i.test(input.file)) {
      return this.inner.stt.transcribe({
        audioUrl: input.file,
        model: tier,
        langHint: input.languageCode,
      });
    }
    return this.inner.stt.transcribe({
      audio: input.file,
      model: tier,
      langHint: input.languageCode,
    });
  }
}

class CompatVoices {
  constructor(private readonly inner: TsageClient) {}

  /** ElevenLabs legacy name. Returns `{ voices: [...] }`. */
  async getAll(): Promise<{ voices: VoicePublic[] }> {
    const voices = await this.inner.voices.list();
    return { voices };
  }

  async search(): Promise<{ voices: VoicePublic[] }> {
    return this.getAll();
  }

  async add(input: CompatVoicesAddInput): Promise<unknown> {
    if (!input.files || input.files.length === 0) {
      throw new TsageError(
        "voices.add requires files=[hosted-url] (TranslatorSage divergence)",
      );
    }
    const first = input.files[0];
    if (!/^https?:\/\//i.test(first)) {
      throw new TsageError(
        "TranslatorSage requires hosted audio URLs for voices.add; upload the file first and pass its public URL.",
      );
    }
    return this.inner.voices.add({ name: input.name, referenceAudioUrl: first });
  }

  async delete(voiceId: string): Promise<unknown> {
    return this.inner.voices.delete(voiceId);
  }
}

class CompatDubbing {
  constructor(private readonly inner: TsageClient) {}

  async create(input: CompatDubbingCreateInput): Promise<unknown> {
    if (!input.targetLang) {
      throw new TsageError("dubbing.create requires targetLang");
    }
    return this.inner.dubbing.create({
      sourceUrl: input.sourceUrl,
      targetLang: input.targetLang,
      name: input.name,
      numSpeakers: input.numSpeakers,
      watermark: input.watermark ?? true,
    });
  }

  async get(dubbingId: string): Promise<unknown> {
    return this.inner.dubbing.get(dubbingId);
  }

  async getAudio(dubbingId: string): Promise<unknown> {
    return this.inner.dubbing.getAudio(dubbingId);
  }
}

/**
 * ElevenLabs SDK look-alike that talks to TranslatorSage.
 *
 * @example
 * import { ElevenLabsCompat } from "@tsage/sdk/elevenlabs-compat";
 * const client = new ElevenLabsCompat({ apiKey: "tsa_live_..." });
 * const resp = await client.textToSpeech.convert("default", {
 *   text: "Hi", modelId: "tsage-tts-v1"
 * });
 */
export class ElevenLabsCompat {
  readonly textToSpeech: CompatTextToSpeech;
  readonly speechToText: CompatSpeechToText;
  readonly voices: CompatVoices;
  readonly dubbing: CompatDubbing;

  private readonly inner: TsageClient;

  constructor(opts: ElevenLabsCompatOptions = {}) {
    this.inner = new TsageClient({
      ...opts,
      baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
    });
    this.textToSpeech = new CompatTextToSpeech(this.inner);
    this.speechToText = new CompatSpeechToText(this.inner);
    this.voices = new CompatVoices(this.inner);
    this.dubbing = new CompatDubbing(this.inner);
  }
}
