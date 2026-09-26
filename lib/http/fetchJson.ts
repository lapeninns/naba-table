import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';

import { HttpError, normalizeError } from './errors';

export type FetchJsonInit = RequestInit & {
  parseJson?: (text: string) => unknown;
  /**
   * Whether a 401/419 sends the browser to `/auth/signin` (default `true`, the
   * ops and account behaviour). Guest booking calls pass `false`: their 401 means
   * the booking link expired, and the page offers a new link instead of sign-in.
   * The error is thrown either way.
   */
  authRedirect?: boolean;
};

/** Options for read-only service calls; pass a TanStack Query `signal` so cancelQueries aborts the fetch. */
export type RequestSignalOptions = {
  readonly signal?: AbortSignal;
};

const defaultParseJson = (text: string) => JSON.parse(text) as unknown;

function ensureHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  return headers;
}

export async function fetchJson<T>(input: RequestInfo | URL, init: FetchJsonInit = {}): Promise<T> {
  const { parseJson = defaultParseJson, authRedirect = true, ...rest } = init;
  const headers = ensureHeaders(rest.headers);
  const csrfToken = getBrowserCsrfToken();
  if (csrfToken && !headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  const response = await fetch(input, {
    ...rest,
    headers,
    credentials: rest.credentials ?? 'include',
  });

  const shouldTriggerAuthRedirect =
    authRedirect && (response.status === 401 || response.status === 419);
  if (shouldTriggerAuthRedirect && typeof window !== 'undefined') {
    void import('@/lib/http/sessionRedirect')
      .then((mod) => mod.triggerSessionRedirect())
      .catch(() => {});
  }

  let text: string | null = null;
  try {
    text = await response.text();
  } catch (cause) {
    if (!response.ok) {
      throw normalizeError({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        cause,
      });
    }
    throw new HttpError({
      message: 'Failed to read response body',
      status: response.status,
      code: 'READ_ERROR',
      cause,
    });
  }

  let parsed: unknown = undefined;
  let parseError: unknown = undefined;
  if (text && text.length > 0) {
    try {
      parsed = parseJson(text);
    } catch (cause) {
      parseError = cause;
    }
  }

  if (!response.ok) {
    const errorBody =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined;
    throw normalizeError({
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
      headers: response.headers,
      cause: parseError,
    });
  }

  if (parseError) {
    throw new HttpError({
      message: 'Failed to parse JSON response',
      status: response.status,
      code: 'INVALID_JSON',
      cause: parseError,
    });
  }

  return (parsed as T) ?? (undefined as T);
}
