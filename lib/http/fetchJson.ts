import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';

import { HttpError, normalizeError } from './errors';

export type FetchJsonInit = RequestInit & {
  parseJson?: (text: string) => unknown;
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
  const { parseJson = defaultParseJson, ...rest } = init;
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

  let text: string | null = null;
  try {
    text = await response.text();
  } catch (cause) {
    if (!response.ok) {
      throw normalizeError({
        status: response.status,
        statusText: response.statusText,
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
    const errorBody = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
    throw normalizeError({
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
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
