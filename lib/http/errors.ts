export interface HttpErrorInit {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
  fields?: Record<string, string[]>;
  retryable?: boolean;
  retryAfter?: number;
  /**
   * Whether `message` came from the server body (or the caller) rather than a
   * statusText/generic fallback. Defaults to true for direct construction.
   */
  hasServerMessage?: boolean;
  cause?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly fields?: Record<string, string[]>;
  readonly retryable?: boolean;
  readonly retryAfter?: number;
  readonly hasServerMessage: boolean;

  constructor({
    message,
    status,
    code,
    details,
    fields,
    retryable,
    retryAfter,
    hasServerMessage,
    cause,
  }: HttpErrorInit) {
    super(message, { cause });
    this.name = 'HttpError';
    this.status = status;
    this.code = code ?? `HTTP_${status}`;
    this.details = details;
    this.fields = fields;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.hasServerMessage = hasServerMessage ?? true;
  }
}

export type ErrorLikeBody = {
  message?: unknown;
  error?: unknown;
  status?: unknown;
  code?: unknown;
  details?: unknown;
  fields?: unknown;
  retryable?: unknown;
  retryAfter?: unknown;
};

export function genericHttpErrorMessage(status: number): string {
  return `Request failed with status ${status}`;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseFields(value: unknown): Record<string, string[]> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const fields: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(record)) {
    if (!Array.isArray(messages)) continue;
    const strings = messages.filter((entry): entry is string => typeof entry === 'string');
    if (strings.length > 0) fields[key] = strings;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function parseSeconds(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.ceil(value)
    : undefined;
}

/** Parses a Retry-After header (delta seconds or HTTP date) into whole seconds. */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (!/[a-z]/i.test(trimmed)) return undefined;
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

export function normalizeError({
  status,
  statusText,
  body,
  headers,
  cause,
}: {
  status: number;
  statusText?: string;
  body?: ErrorLikeBody | null;
  headers?: Headers | null;
  cause?: unknown;
}): HttpError {
  const nested = asRecord(body?.error);

  const serverMessage =
    nonEmptyString(body?.message) ?? nonEmptyString(body?.error) ?? nonEmptyString(nested?.message);

  const message = serverMessage ?? nonEmptyString(statusText) ?? genericHttpErrorMessage(status);

  const code = nonEmptyString(body?.code) ?? nonEmptyString(nested?.code) ?? `HTTP_${status}`;

  const retryable = typeof body?.retryable === 'boolean' ? body.retryable : undefined;
  const retryAfter =
    parseSeconds(body?.retryAfter) ?? parseRetryAfter(headers?.get('Retry-After') ?? null);

  return new HttpError({
    message,
    status,
    code,
    details: body?.details !== undefined ? body.details : nested?.details,
    fields: parseFields(body?.fields),
    retryable,
    retryAfter,
    hasServerMessage: serverMessage !== undefined,
    cause,
  });
}
