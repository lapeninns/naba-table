import { genericHttpErrorMessage, HttpError } from './errors';

export const DEFAULT_ERROR_COPY = {
  unauthenticated: 'Your session has ended. Sign in again.',
  forbidden: "You don't have permission to do that.",
  notFound: 'That item no longer exists.',
  conflict: 'This changed while you were working. Refresh and try again.',
  rateLimited: 'Too many attempts. Wait a moment and try again.',
  server: 'Something went wrong on our side. Try again.',
  network: "Couldn't reach the server. Check your connection and try again.",
  fallback: 'Something went wrong. Try again.',
} as const;

export type ToUserMessageOptions = {
  /** Copy keyed by server error code; wins over every other source. */
  copy?: Partial<Record<string, string>>;
  fallback?: string;
};

const NETWORK_MESSAGE_PATTERN =
  /failed to fetch|fetch failed|load failed|networkerror|network request failed|network error/i;

/** True for fetch-level failures (offline, DNS, CORS, connection reset). */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'NetworkError') return true;
  return error instanceof TypeError && NETWORK_MESSAGE_PATTERN.test(error.message);
}

function statusCopy(status: number): string | undefined {
  if (status === 401 || status === 419) return DEFAULT_ERROR_COPY.unauthenticated;
  if (status === 403) return DEFAULT_ERROR_COPY.forbidden;
  if (status === 404) return DEFAULT_ERROR_COPY.notFound;
  if (status === 409) return DEFAULT_ERROR_COPY.conflict;
  if (status === 429) return DEFAULT_ERROR_COPY.rateLimited;
  if (status >= 500) return DEFAULT_ERROR_COPY.server;
  return undefined;
}

function isPresentableServerMessage(error: HttpError): boolean {
  if (error.status < 400 || error.status >= 500) return false;
  if (!error.hasServerMessage) return false;
  const message = error.message.trim();
  return message.length > 0 && message !== genericHttpErrorMessage(error.status);
}

/**
 * Resolves user-facing copy: caller copy by code, then a 4xx server message,
 * then default copy for the status (or network failure), then the fallback.
 * A 5xx server message is never shown.
 */
export function toUserMessage(error: unknown, opts: ToUserMessageOptions = {}): string {
  const fallback = opts.fallback ?? DEFAULT_ERROR_COPY.fallback;

  if (error instanceof HttpError) {
    const override = opts.copy?.[error.code];
    if (override) return override;
    if (isPresentableServerMessage(error)) return error.message.trim();
    return statusCopy(error.status) ?? fallback;
  }

  if (isNetworkError(error)) return DEFAULT_ERROR_COPY.network;
  return fallback;
}

/** Server field messages (dot paths) for binding into a form, if any. */
export function getFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (!(error instanceof HttpError) || !error.fields) return undefined;
  return Object.keys(error.fields).length > 0 ? error.fields : undefined;
}
