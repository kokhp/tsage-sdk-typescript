/**
 * Exception hierarchy for the TranslatorSage TypeScript SDK.
 *
 * Mirrors tsage-sdk-python so cross-language debugging feels identical.
 */

export interface TsageErrorInit {
  statusCode?: number;
  body?: unknown;
  requestId?: string | null;
}

export class TsageError extends Error {
  public readonly statusCode: number;
  public readonly body: unknown;
  public readonly requestId: string | null;

  constructor(message: string, init: TsageErrorInit = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = init.statusCode ?? 0;
    this.body = init.body ?? null;
    this.requestId = init.requestId ?? null;
    // Restore proto chain for ES5 targets / older node versions.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 — missing / invalid / revoked API key. */
export class TsageAuthError extends TsageError {}

/** 400 or 422 — request body failed validation. */
export class TsageValidationError extends TsageError {}

/** 402 — consumer balance is below the preflight cost of this request. */
export class TsageInsufficientBalanceError extends TsageError {}

/** 404 — resource (voice, dubbing job, api key, ...) does not exist. */
export class TsageNotFoundError extends TsageError {}

/** 429 — too many requests; retry with exponential backoff. */
export class TsageRateLimitError extends TsageError {}

/** 5xx — orchestrator or upstream (RunPod / Supabase / Dodo) is unhealthy. */
export class TsageServerError extends TsageError {}

const STATUS_MAP: Record<number, new (msg: string, init?: TsageErrorInit) => TsageError> = {
  400: TsageValidationError,
  401: TsageAuthError,
  402: TsageInsufficientBalanceError,
  404: TsageNotFoundError,
  422: TsageValidationError,
  429: TsageRateLimitError,
};

function messageFromBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (typeof body === "object") {
    const b = body as Record<string, unknown>;
    const detail = b.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const d = detail as Record<string, unknown>;
      if (typeof d.error === "string") return d.error;
      if (typeof d.message === "string") return d.message;
      return JSON.stringify(detail);
    }
    for (const key of ["message", "error"]) {
      const v = b[key];
      if (typeof v === "string") return v;
    }
  }
  return null;
}

export function errorForStatus(
  statusCode: number,
  body: unknown,
  requestId: string | null,
): TsageError {
  const message = messageFromBody(body) ?? `HTTP ${statusCode}`;
  const Ctor =
    statusCode >= 500
      ? TsageServerError
      : STATUS_MAP[statusCode] ?? TsageError;
  return new Ctor(message, { statusCode, body, requestId });
}
