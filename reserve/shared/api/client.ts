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

async function request<TResponse>(
  path: string,
  { method = 'GET', headers, body, signal, ...init }: RequestInit & { method?: HttpMethod } = {},
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.API_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.API_BASE_URL}${path}`, {
      method,
      headers: { ...defaultHeaders, ...headers },
      body,
      signal: signal ?? controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  get: <TResponse>(path: string, init?: RequestInit) =>
    request<TResponse>(path, { ...init, method: 'GET' }),
  post: <TResponse>(path: string, body: unknown, init?: RequestInit) =>
    request<TResponse>(path, { ...init, method: 'POST', body: JSON.stringify(body) }),
  put: <TResponse>(path: string, body: unknown, init?: RequestInit) =>
    request<TResponse>(path, { ...init, method: 'PUT', body: JSON.stringify(body) }),
  patch: <TResponse>(path: string, body: unknown, init?: RequestInit) =>
    request<TResponse>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <TResponse>(path: string, init?: RequestInit) =>
    request<TResponse>(path, { ...init, method: 'DELETE' }),
};
