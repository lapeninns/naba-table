import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';
import { env } from '@shared/config/env';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
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

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      const normalized: ApiError = {
        code: parsed?.code ?? `${response.status}`,
        message: parsed?.message ?? response.statusText ?? 'Request failed',
        details: parsed?.details,
        status: response.status,
      };
      throw normalized;
    }

    return parsed as TResponse;
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
