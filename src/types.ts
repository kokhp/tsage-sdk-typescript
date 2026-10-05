/**
 * Public, hand-maintained types for the TranslatorSage TypeScript SDK.
 *
 * These shadow the Pydantic v2 schemas in the orchestrator one-for-one.
 * Prefer these over the generated schema types in `./_generated/schema` for
 * day-to-day use; the generated schema is useful for strict request-body
 * typing and for routes we haven't exposed on the fluent client yet.
 */

// ---------- Consumers ----------

export interface SignupRequest {
  email: string;
  referral_code?: string | null;
  signup_ip?: string | null;
  device_fingerprint?: string | null;
}

export interface SignupResponse {
  consumer_id: string;
  email: string;
  referral_code: string;
  balance_micros: number;
  balance_usd: number;
  api_key: string;
  api_key_id: string;
}

export interface ConsumerProfile {
  consumer_id: string;
  email: string;
  referral_code: string;
  balance_micros: number;
  balance_usd: number;
  welcome_gift_claimed: boolean;
  api_key_count: number;
}

export interface CreateApiKeyRequest {
  name?: string | null;
  concurrent_limit?: number | null;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string | null;
  prefix: string;
  plaintext: string;
}

export interface ApiKeyPublic {
  id: string;
  name: string | null;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// ---------- TTS ----------

export interface TTSRequest {
  text: string;
  model_id?: string | null;
  voice_settings?: Record<string, unknown> | null;
  output_format?: string;
}

export interface TTSResponse {
  audio: string; // base64
  units_billed?: number;
  cost_micros?: number;
  balance_after_micros?: number;
  [extra: string]: unknown;
}

// ---------- STT ----------

export interface STTResponse {
  text: string;
  language?: string | null;
  duration?: number | null;
  words?: Array<Record<string, unknown>> | null;
  segments?: Array<Record<string, unknown>>;
  speakers?: Array<Record<string, unknown>>;
  [extra: string]: unknown;
}

// ---------- Translation ----------

export interface TranslateRequest {
  text: string;
  target_lang: string;
  source_lang?: string | null;
}

export interface TranslateResponse {
  translated_text: string;
  source_lang: string;
  target_lang: string;
  units_billed: number;
  cost_micros: number;
  balance_after_micros: number;
  [extra: string]: unknown;
}

// ---------- Dubbing ----------

export type DubbingStatus = "queued" | "running" | "succeeded" | "failed";

export interface DubbingRequest {
  target_lang: string;
  source_url?: string | null;
  source_lang?: string | null;
  num_speakers?: number | null;
  watermark?: boolean;
  name?: string | null;
}

export interface DubbingCreateResponse {
  job_id: string;
  status: DubbingStatus;
  target_lang: string;
  source_lang?: string | null;
  created_at?: string | null;
  duration_min_estimate?: number | null;
  cost_micros?: number | null;
  balance_after_micros?: number | null;
  [extra: string]: unknown;
}

export interface DubbingGetResponse extends DubbingCreateResponse {
  audio_url?: string | null;
  srt_url?: string | null;
}

// ---------- Voices ----------

export type VoiceType = "ivc" | "pvc" | "preset" | "library";
export type VoiceVisibility = "private" | "library";

export interface VoicePublic {
  voice_id: string;
  name: string;
  type: VoiceType;
  visibility: VoiceVisibility;
  lang_support: string[] | null;
  created_at: string;
  [extra: string]: unknown;
}

export interface VoiceAddRequest {
  name: string;
  reference_audio_url: string;
  lang_support?: string[] | null;
  consent_doc_url?: string | null;
}

export interface VoiceAddResponse extends VoicePublic {}
