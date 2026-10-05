/**
 * Official TypeScript SDK for the TranslatorSage API.
 *
 * @example
 * import { TsageClient } from "@tsage/sdk";
 * const client = new TsageClient({ apiKey: "tsa_live_..." });
 * const resp = await client.tts.synthesize({ text: "Hello world" });
 *
 * ElevenLabs-compatible drop-in:
 *
 * @example
 * import { ElevenLabsCompat } from "@tsage/sdk/elevenlabs-compat";
 * const client = new ElevenLabsCompat({ apiKey: "tsa_live_..." });
 * const audio = await client.textToSpeech.convert("default", { text: "Hi" });
 */

export {
  TsageClient,
  TsageHttp,
  DEFAULT_BASE_URL,
  TTSNamespace,
  STTNamespace,
  TranslateNamespace,
  DubbingNamespace,
  VoicesNamespace,
  ConsumersNamespace,
  SFXNamespace,
  VoiceDesignNamespace,
  AgentsNamespace,
} from "./client.js";

export type {
  TsageClientOptions,
  TTSSynthesizeInput,
  STTTranscribeInput,
  TranslateInput,
  DubbingCreateInput,
  VoiceAddInput,
  SignupInput,
  CreateApiKeyInput,
  SFXGenerateInput,
  VoiceDesignInput,
  AgentConverseInput,
} from "./client.js";

export {
  TsageError,
  TsageAuthError,
  TsageValidationError,
  TsageInsufficientBalanceError,
  TsageNotFoundError,
  TsageRateLimitError,
  TsageServerError,
  errorForStatus,
} from "./errors.js";

export type { TsageErrorInit } from "./errors.js";

export type {
  ApiKeyPublic,
  ConsumerProfile,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  DubbingCreateResponse,
  DubbingGetResponse,
  DubbingRequest,
  DubbingStatus,
  SignupRequest,
  SignupResponse,
  STTResponse,
  TTSRequest,
  TTSResponse,
  TranslateRequest,
  TranslateResponse,
  VoiceAddRequest,
  VoiceAddResponse,
  VoicePublic,
  VoiceType,
  VoiceVisibility,
} from "./types.js";

export const VERSION = "0.1.0-alpha.0";
