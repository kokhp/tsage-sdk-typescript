/**
 * High-level, typed TranslatorSage client.
 *
 * Namespace objects mirror the FastAPI orchestrator routes:
 *   client.tts.synthesize(...)
 *   client.stt.transcribe(...)
 *   client.dubbing.create(...) / .get(...) / .wait(...)
 *   client.translate.translate(...)
 *   client.voices.list(...) / .add(...) / ...
 *   client.consumers.signup(...) / .me(...) / ...
 */

import { errorForStatus, TsageAuthError, TsageError } from "./errors.js";
import type {
  ConsumerProfile,
  CreateApiKeyResponse,
  DubbingCreateResponse,
  DubbingGetResponse,
  SignupResponse,
  STTResponse,
  TranslateResponse,
  TTSResponse,
  VoiceAddResponse,
  VoicePublic,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://developers.translatorsage.com";
const USER_AGENT = "tsage-sdk-typescript/0.1.0-alpha.0";

export interface TsageClientOptions {
  apiKey?: string | null;
  baseUrl?: string;
  /** Request timeout in milliseconds (default 60000). */
  timeoutMs?: number;
  /** Custom fetch implementation (default: global fetch). */
  fetch?: typeof fetch;
  /** Extra headers merged into every request. */
  defaultHeaders?: Record<string, string>;
}

interface RequestOptions {
  method: "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  formData?: FormData;
  auth?: boolean;
  /** If true, return raw Response (for streaming / binary). */
  rawResponse?: boolean;
}

/** Internal HTTP driver. */
export class TsageHttp {
  readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetchImpl: typeof fetch;
  readonly defaultHeaders: Record<string, string>;

  constructor(opts: TsageClientOptions = {}) {
    this.apiKey = opts.apiKey ?? null;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetch ?? fetch;
    this.defaultHeaders = {
      "User-Agent": USER_AGENT,
      ...(opts.defaultHeaders ?? {}),
    };
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    const url = this.buildUrl(opts.path, opts.query);
    const headers: Record<string, string> = { ...this.defaultHeaders };
    const auth = opts.auth ?? true;
    if (auth) {
      if (!this.apiKey) {
        throw new TsageAuthError("no_api_key_configured", { statusCode: 401 });
      }
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let body: BodyInit | undefined;
    if (opts.formData) {
      body = opts.formData;
      // Let fetch set the multipart boundary.
    } else if (opts.body !== undefined && opts.body !== null) {
      body = JSON.stringify(stripUndefined(opts.body));
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: opts.method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof TsageError) throw err;
      throw new TsageError(
        err instanceof Error ? err.message : String(err),
        { statusCode: 0 },
      );
    }
    clearTimeout(timer);

    const requestId = resp.headers.get("x-request-id");

    if (!resp.ok) {
      let errBody: unknown;
      const ct = resp.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        try {
          errBody = await resp.json();
        } catch {
          errBody = await safeText(resp);
        }
      } else {
        errBody = await safeText(resp);
      }
      throw errorForStatus(resp.status, errBody, requestId);
    }

    if (opts.rawResponse) {
      return resp as unknown as T;
    }

    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return (await resp.json()) as T;
    }
    // Binary fallthrough.
    return (await resp.arrayBuffer()) as unknown as T;
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const base = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
}

function stripUndefined<T>(obj: T): T {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as T;
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

// ---------- Namespace classes ----------

export interface TTSSynthesizeInput {
  text: string;
  voiceId?: string;
  modelId?: string | null;
  voiceSettings?: Record<string, unknown> | null;
  outputFormat?: string;
  /** Convenience; folded into voice_settings.lang if voice_settings omitted. */
  lang?: string;
}

export class TTSNamespace {
  constructor(private readonly http: TsageHttp) {}

  async synthesize(input: TTSSynthesizeInput): Promise<TTSResponse> {
    const voiceId = input.voiceId ?? "default";
    let voiceSettings = input.voiceSettings ?? null;
    if (input.lang) {
      voiceSettings = { ...(voiceSettings ?? {}), lang: input.lang };
    }
    return this.http.request<TTSResponse>({
      method: "POST",
      path: `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      body: {
        text: input.text,
        model_id: input.modelId ?? "tsage-tts-v1",
        voice_settings: voiceSettings,
        output_format: input.outputFormat ?? "mp3_44100_128",
      },
    });
  }

  /** Convenience: synthesize and return raw decoded audio bytes. */
  async synthesizeBytes(input: TTSSynthesizeInput): Promise<Uint8Array> {
    const resp = await this.synthesize(input);
    const audio = resp.audio as unknown;
    if (typeof audio === "string") {
      return base64Decode(audio);
    }
    if (audio instanceof Uint8Array) return audio;
    throw new TsageError("TTS response had no decodable 'audio' field", {
      body: resp,
    });
  }

  /** Async iterable of chunks (chunk_size default 4096). V1 slices client-side. */
  async *stream(
    input: TTSSynthesizeInput & { chunkSize?: number },
  ): AsyncIterable<Uint8Array> {
    const data = await this.synthesizeBytes(input);
    const chunkSize = input.chunkSize ?? 4096;
    for (let i = 0; i < data.length; i += chunkSize) {
      yield data.slice(i, i + chunkSize);
    }
  }
}

export interface STTTranscribeInput {
  /** Audio: Blob, Uint8Array/ArrayBuffer, or a URL (we pre-fetch client-side). */
  audio?: Blob | Uint8Array | ArrayBuffer | string;
  audioUrl?: string;
  model?: "standard" | "live" | "medical" | "raw" | string;
  durationHintSeconds?: number;
  filename?: string;
  langHint?: string;
}

export class STTNamespace {
  constructor(private readonly http: TsageHttp) {}

  async transcribe(input: STTTranscribeInput): Promise<STTResponse> {
    let audio = input.audio;
    let filename = input.filename ?? "audio.wav";

    if (!audio && input.audioUrl) {
      const r = await fetch(input.audioUrl);
      if (!r.ok) {
        throw new TsageError(
          `failed to fetch audio_url: ${r.status}`,
          { statusCode: r.status },
        );
      }
      audio = new Uint8Array(await r.arrayBuffer());
      const tail = input.audioUrl.split("/").pop() ?? "";
      if (tail.includes(".")) filename = tail;
    }

    if (!audio) {
      throw new TsageError("transcribe() requires audio or audioUrl");
    }

    let blob: Blob;
    if (audio instanceof Blob) {
      blob = audio;
    } else if (audio instanceof ArrayBuffer) {
      blob = new Blob([audio]);
    } else if (audio instanceof Uint8Array) {
      // Copy to a plain ArrayBuffer so Blob accepts the typed array under
      // strict DOM typings (Uint8Array<ArrayBufferLike> vs BlobPart).
      const buf = new ArrayBuffer(audio.byteLength);
      new Uint8Array(buf).set(audio);
      blob = new Blob([buf]);
    } else {
      throw new TsageError("audio must be Blob | Uint8Array | ArrayBuffer | URL string");
    }

    const form = new FormData();
    form.append("audio", blob, filename);

    const query: Record<string, string | number | undefined> = {
      model: input.model ?? "standard",
    };
    if (input.durationHintSeconds !== undefined) {
      query.duration_hint_seconds = input.durationHintSeconds;
    }

    return this.http.request<STTResponse>({
      method: "POST",
      path: "/v1/speech-to-text",
      query,
      formData: form,
    });
  }
}

export interface TranslateInput {
  text: string;
  targetLang: string;
  sourceLang?: string | null;
}

export class TranslateNamespace {
  constructor(private readonly http: TsageHttp) {}

  async translate(input: TranslateInput): Promise<TranslateResponse> {
    return this.http.request<TranslateResponse>({
      method: "POST",
      path: "/v1/translate",
      body: {
        text: input.text,
        target_lang: input.targetLang,
        source_lang: input.sourceLang,
      },
    });
  }

  /** Alias so client.translate.text(...) also works. */
  text(input: TranslateInput): Promise<TranslateResponse> {
    return this.translate(input);
  }
}

export interface DubbingCreateInput {
  targetLang: string;
  /** Preferred: source URL. */
  sourceUrl?: string;
  /** ElevenLabs alias — same as sourceUrl. */
  videoUrl?: string;
  sourceLang?: string;
  numSpeakers?: number;
  watermark?: boolean;
  name?: string;
}

export class DubbingNamespace {
  constructor(private readonly http: TsageHttp) {}

  async create(input: DubbingCreateInput): Promise<DubbingCreateResponse> {
    const sourceUrl = input.sourceUrl ?? input.videoUrl;
    return this.http.request<DubbingCreateResponse>({
      method: "POST",
      path: "/v1/dubbing",
      body: {
        source_url: sourceUrl,
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        num_speakers: input.numSpeakers,
        watermark: input.watermark ?? true,
        name: input.name,
      },
    });
  }

  async get(jobId: string): Promise<DubbingGetResponse> {
    return this.http.request<DubbingGetResponse>({
      method: "GET",
      path: `/v1/dubbing/${encodeURIComponent(jobId)}`,
    });
  }

  async getAudio(jobId: string): Promise<unknown> {
    return this.http.request({
      method: "GET",
      path: `/v1/dubbing/${encodeURIComponent(jobId)}/audio`,
    });
  }

  /** Poll until the job reaches a terminal state (succeeded or failed). */
  async wait(
    jobId: string,
    opts: { pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<DubbingGetResponse> {
    const pollIntervalMs = opts.pollIntervalMs ?? 5_000;
    const timeoutMs = opts.timeoutMs ?? 60 * 60 * 1000;
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const job = await this.get(jobId);
      if (job.status === "succeeded" || job.status === "failed") {
        return job;
      }
      if (Date.now() >= deadline) {
        throw new TsageError(
          `dubbing job ${jobId} did not reach terminal state within ${timeoutMs}ms ` +
            `(last status=${job.status})`,
        );
      }
      await sleep(pollIntervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface VoiceAddInput {
  name: string;
  referenceAudioUrl: string;
  langSupport?: string[];
  consentDocUrl?: string;
}

export class VoicesNamespace {
  constructor(private readonly http: TsageHttp) {}

  async list(): Promise<VoicePublic[]> {
    return this.http.request<VoicePublic[]>({
      method: "GET",
      path: "/v1/voices",
    });
  }

  async add(input: VoiceAddInput): Promise<VoiceAddResponse> {
    return this.http.request<VoiceAddResponse>({
      method: "POST",
      path: "/v1/voices/add",
      body: {
        name: input.name,
        reference_audio_url: input.referenceAudioUrl,
        lang_support: input.langSupport,
        consent_doc_url: input.consentDocUrl,
      },
    });
  }

  async promoteToPvc(voiceId: string): Promise<unknown> {
    return this.http.request({
      method: "POST",
      path: `/v1/voices/${encodeURIComponent(voiceId)}/professional`,
    });
  }

  async delete(voiceId: string): Promise<unknown> {
    return this.http.request({
      method: "DELETE",
      path: `/v1/voices/${encodeURIComponent(voiceId)}`,
    });
  }
}

export interface SignupInput {
  email: string;
  referralCode?: string;
  signupIp?: string;
  deviceFingerprint?: string;
}

export interface CreateApiKeyInput {
  name?: string;
  concurrentLimit?: number;
}

export class ConsumersNamespace {
  constructor(private readonly http: TsageHttp) {}

  async signup(input: SignupInput): Promise<SignupResponse> {
    return this.http.request<SignupResponse>({
      method: "POST",
      path: "/v1/consumers/signup",
      body: {
        email: input.email,
        referral_code: input.referralCode,
        signup_ip: input.signupIp,
        device_fingerprint: input.deviceFingerprint,
      },
      auth: false,
    });
  }

  async me(): Promise<ConsumerProfile> {
    return this.http.request<ConsumerProfile>({
      method: "GET",
      path: "/v1/consumers/me",
    });
  }

  async listApiKeys(): Promise<unknown[]> {
    return this.http.request<unknown[]>({
      method: "GET",
      path: "/v1/consumers/me/api-keys",
    });
  }

  async createApiKey(input: CreateApiKeyInput = {}): Promise<CreateApiKeyResponse> {
    return this.http.request<CreateApiKeyResponse>({
      method: "POST",
      path: "/v1/consumers/me/api-keys",
      body: {
        name: input.name,
        concurrent_limit: input.concurrentLimit,
      },
    });
  }

  async revokeApiKey(apiKeyId: string): Promise<unknown> {
    return this.http.request({
      method: "DELETE",
      path: `/v1/consumers/me/api-keys/${encodeURIComponent(apiKeyId)}`,
    });
  }

  async usage(): Promise<unknown> {
    return this.http.request({
      method: "GET",
      path: "/v1/consumers/me/usage",
    });
  }
}

export interface SFXGenerateInput {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
}

export class SFXNamespace {
  constructor(private readonly http: TsageHttp) {}

  async generate(input: SFXGenerateInput): Promise<unknown> {
    return this.http.request({
      method: "POST",
      path: "/v1/sound-effects",
      body: {
        text: input.text,
        duration_seconds: input.durationSeconds,
        prompt_influence: input.promptInfluence,
      },
    });
  }
}

export interface VoiceDesignInput {
  description: string;
  text?: string;
  gender?: string;
  age?: string;
  accent?: string;
}

export class VoiceDesignNamespace {
  constructor(private readonly http: TsageHttp) {}

  async design(input: VoiceDesignInput): Promise<unknown> {
    return this.http.request({
      method: "POST",
      path: "/v1/voice-design",
      body: {
        description: input.description,
        text: input.text,
        gender: input.gender,
        age: input.age,
        accent: input.accent,
      },
    });
  }
}

export interface AgentConverseInput {
  agentId: string;
  message: string;
  hints?: Record<string, unknown>;
}

export class AgentsNamespace {
  constructor(private readonly http: TsageHttp) {}

  async converse(input: AgentConverseInput): Promise<unknown> {
    return this.http.request({
      method: "POST",
      path: `/v1/agents/${encodeURIComponent(input.agentId)}/converse`,
      body: { message: input.message, hints: input.hints },
    });
  }
}

// ---------- Main client ----------

/**
 * Synchronous TranslatorSage API client.
 *
 * @example
 * const client = new TsageClient({ apiKey: "tsa_live_..." });
 * const resp = await client.tts.synthesize({ text: "Hello" });
 */
export class TsageClient {
  readonly http: TsageHttp;
  readonly tts: TTSNamespace;
  readonly textToSpeech: TTSNamespace;
  readonly stt: STTNamespace;
  readonly speechToText: STTNamespace;
  readonly translate: TranslateNamespace;
  readonly dubbing: DubbingNamespace;
  readonly voices: VoicesNamespace;
  readonly consumers: ConsumersNamespace;
  readonly sfx: SFXNamespace;
  readonly soundEffects: SFXNamespace;
  readonly voiceDesign: VoiceDesignNamespace;
  readonly agents: AgentsNamespace;

  constructor(opts: TsageClientOptions = {}) {
    this.http = new TsageHttp(opts);
    this.tts = new TTSNamespace(this.http);
    this.textToSpeech = this.tts;
    this.stt = new STTNamespace(this.http);
    this.speechToText = this.stt;
    this.translate = new TranslateNamespace(this.http);
    this.dubbing = new DubbingNamespace(this.http);
    this.voices = new VoicesNamespace(this.http);
    this.consumers = new ConsumersNamespace(this.http);
    this.sfx = new SFXNamespace(this.http);
    this.soundEffects = this.sfx;
    this.voiceDesign = new VoiceDesignNamespace(this.http);
    this.agents = new AgentsNamespace(this.http);
  }
}

// ---------- base64 helpers (work in node + browser) ----------

function base64Decode(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
