import { genericHttpErrorMessage } from '@/lib/http/errors';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';
import { env } from '@shared/config/env';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  body?: unknown;
  status?: number;
};

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

function composeHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(defaultHeaders);
  if (init) {
    const incoming = new Headers(init);
    incoming.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

type ParsedBody = { ok: true; value: unknown } | { ok: false };

function parseBody(text: string): ParsedBody {
  if (!text) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

type RequestOptions = RequestInit & { method?: HttpMethod; timeoutMs?: number };

function mergeSignals(source: AbortController, external?: AbortSignal | null): () => void {
  if (!external) {
    return () => {};
  }

  if (external.aborted) {
    source.abort(external.reason ?? new DOMException('Request aborted', 'AbortError'));
    return () => {};
  }

  const forwardAbort = () => {
    source.abort(external.reason ?? new DOMException('Request aborted', 'AbortError'));
  };

  external.addEventListener('abort', forwardAbort, { once: true });

  return () => external.removeEventListener('abort', forwardAbort);
}

function inferTimeoutMs(timeoutMs: number | undefined): number | null {
  if (typeof timeoutMs === 'number') {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return null;
    }
    return timeoutMs;
  }
  if (!Number.isFinite(env.API_TIMEOUT_MS) || env.API_TIMEOUT_MS <= 0) {
    return null;
  }
  return env.API_TIMEOUT_MS;
}

async function request<TResponse>(
  path: string,
  { method = 'GET', headers, body, signal, timeoutMs, ...init }: RequestOptions = {},
): Promise<TResponse> {
  const controller = new AbortController();
  const removeExternalListener = mergeSignals(controller, signal);
  const requestHeaders = composeHeaders(headers);
  const csrfToken = getBrowserCsrfToken();
  if (csrfToken && !requestHeaders.has(CSRF_HEADER_NAME)) {
    requestHeaders.set(CSRF_HEADER_NAME, csrfToken);
  }

  const resolvedTimeout = inferTimeoutMs(timeoutMs);
  const timeoutHandle =
    resolvedTimeout !== null
      ? setTimeout(() => {
          controller.abort(new DOMException('Request timed out', 'TimeoutError'));
        }, resolvedTimeout)
      : null;

  try {
    const response = await fetch(`${env.API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body,
      signal: controller.signal,
      credentials: 'include',
      ...init,
    });

    const shouldTriggerAuthRedirect = response.status === 401 || response.status === 419;
    if (shouldTriggerAuthRedirect && typeof window !== 'undefined') {
      void import('@/lib/http/sessionRedirect')
        .then((mod) => mod.triggerSessionRedirect())
        .catch(() => {});
    }

    const text = await response.text();
    const parsed = parseBody(text);

    if (!response.ok) {
      // A proxy/platform error page (e.g. a text/plain 504) is not JSON: keep only the
      // status, so callers map it to status copy instead of showing parser text.
      const body = parsed.ok ? asRecord(parsed.value) : undefined;
      const normalized: ApiError = {
        code: readNonEmptyString(body?.code) ?? `${response.status}`,
        message:
          readNonEmptyString(body?.message) ??
          readNonEmptyString(body?.error) ??
          genericHttpErrorMessage(response.status),
        details: body?.details,
        body: parsed.ok ? parsed.value : undefined,
        status: response.status,
      };
      throw normalized;
    }

    if (!parsed.ok) {
      const invalid: ApiError = {
        code: 'INVALID_RESPONSE',
        message: 'We could not read the server response. Please try again.',
        status: response.status,
      };
      throw invalid;
    }

    return parsed.value as TResponse;
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'TimeoutError') {
        const timeoutError: ApiError = {
          code: 'TIMEOUT',
          message: 'Request timed out. Please try again.',
          status: 408,
        };
        throw timeoutError;
      }
      if (error.name === 'AbortError') {
        const reason = controller.signal.reason ?? null;
        let reasonMessage: string | null = null;
        if (typeof reason === 'string') {
          reasonMessage = reason;
        } else if (
          reason &&
          typeof reason === 'object' &&
          typeof (reason as { message?: unknown }).message === 'string'
        ) {
          reasonMessage = (reason as { message: string }).message;
        }
        const derivedMessage =
          reasonMessage && reasonMessage.trim().length > 0
            ? reasonMessage.trim()
            : 'Request was cancelled.';
        const abortError: ApiError = {
          code: 'REQUEST_ABORTED',
          message: derivedMessage,
          status: 499,
        };
        throw abortError;
      }
    }
    throw error;
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
    removeExternalListener();
  }
}

export const apiClient = {
  get: <TResponse>(path: string, init?: RequestOptions) =>
    request<TResponse>(path, { ...init, method: 'GET' }),
  post: <TResponse>(path: string, body: unknown, init?: RequestOptions) =>
    request<TResponse>(path, { ...init, method: 'POST', body: JSON.stringify(body) }),
  put: <TResponse>(path: string, body: unknown, init?: RequestOptions) =>
    request<TResponse>(path, { ...init, method: 'PUT', body: JSON.stringify(body) }),
  patch: <TResponse>(path: string, body: unknown, init?: RequestOptions) =>
    request<TResponse>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <TResponse>(path: string, init?: RequestOptions) =>
    request<TResponse>(path, { ...init, method: 'DELETE' }),
};
