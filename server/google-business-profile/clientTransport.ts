import ky from 'ky';
import { z } from 'zod';

import { env } from '@/lib/env';

import { GoogleBusinessProfileError } from './errors';
import { readGoogleJsonResponse, withinGoogleDeadline } from './responseBody';

const TOTAL_DEADLINE_MS = 15_000;
const MAX_RETRY_DELAY_MS = 5_000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const PROTECTED_HEADERS = new Set([
  'authorization',
  'content-type',
  'x-goog-user-project',
  'x-goog-api-format-version',
]);
const GOOGLE_ORIGINS = new Set([
  'https://mybusinessaccountmanagement.googleapis.com',
  'https://mybusinessbusinessinformation.googleapis.com',
  'https://mybusiness.googleapis.com',
  'https://mybusinessnotifications.googleapis.com',
  'https://oauth2.googleapis.com',
  'https://accounts.google.com',
  'https://openidconnect.googleapis.com',
]);

export class GoogleProviderError extends GoogleBusinessProfileError {}

export type GoogleTransportDependencies = {
  readonly now?: () => number;
  readonly random?: () => number;
  readonly sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly fetch?: typeof globalThis.fetch;
};

export type GoogleJsonTransport = {
  readonly request: <T>(
    path: string,
    schema: z.ZodType<T>,
    options?: {
      readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      readonly headers?: HeadersInit;
      readonly json?: unknown;
      readonly searchParams?: URLSearchParams | Readonly<Record<string, string>>;
      readonly retry?: boolean;
    },
  ) => Promise<T>;
};

type TransportConfig = GoogleTransportDependencies & {
  readonly origin: string;
  readonly accessToken?: string;
  readonly quotaProject?: string | null;
};

function sleepDefault(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function assertSafePath(path: string): void {
  if (!path || path.startsWith('/') || path.startsWith('//') || URL.canParse(path)) {
    throw new GoogleProviderError('Google provider path is invalid.', {
      code: 'GBP_INVALID_PROVIDER_PATH',
      status: 500,
    });
  }
}

function assertHeadersSafe(headers: HeadersInit | undefined): void {
  const candidate = new Headers(headers);
  for (const name of PROTECTED_HEADERS) {
    if (candidate.has(name)) {
      throw new GoogleProviderError('A protected Google provider header cannot be overridden.', {
        code: 'GBP_PROTECTED_HEADER_OVERRIDE',
        status: 500,
      });
    }
  }
}

function providerError(response: Response): GoogleProviderError {
  const status = response.status;
  const kind =
    status === 401
      ? 'reauth'
      : status === 403
        ? 'access_lost'
        : status === 404
          ? 'not_found'
          : status === 409 || status === 412
            ? 'conflict'
            : status === 429
              ? 'quota'
              : 'upstream';
  const code = `GBP_${kind.toUpperCase()}`;
  return new GoogleProviderError('Google provider request failed.', {
    code,
    status: kind === 'reauth' || kind === 'access_lost' ? 409 : 502,
    kind,
    upstreamStatus: status,
    upstreamReason: response.statusText || undefined,
    requestId:
      response.headers.get('x-request-id') ??
      response.headers.get('x-guploader-uploadid') ??
      undefined,
  });
}

function retryAfterMs(response: Response, now: number): number | null {
  const value = response.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function createGoogleJsonTransport(config: TransportConfig): GoogleJsonTransport {
  const origin = new URL(config.origin).origin;
  if (!GOOGLE_ORIGINS.has(origin)) {
    throw new GoogleProviderError('Google provider origin is not allowed.', {
      code: 'GBP_INVALID_PROVIDER_ORIGIN',
      status: 500,
    });
  }
  const now = config.now ?? Date.now;
  const random = config.random ?? Math.random;
  const sleep = config.sleep ?? sleepDefault;
  const client = ky.create({ prefix: `${origin}/`, retry: 0, timeout: false, fetch: config.fetch });
  return {
    async request(path, schema, options = {}) {
      assertSafePath(path);
      assertHeadersSafe(options.headers);
      const method = options.method ?? 'GET';
      const controller = new AbortController();
      const startedAt = now();
      const timer = setTimeout(
        () => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')),
        TOTAL_DEADLINE_MS,
      );
      try {
        for (let attempt = 0; ; attempt += 1) {
          try {
            const headers = new Headers(options.headers);
            if (config.accessToken) headers.set('Authorization', `Bearer ${config.accessToken}`);
            headers.set('Content-Type', 'application/json');
            headers.set('X-GOOG-API-FORMAT-VERSION', '2');
            if (config.quotaProject) headers.set('X-Goog-User-Project', config.quotaProject);
            const response = await client(path, {
              method,
              headers,
              json: options.json,
              searchParams: options.searchParams,
              signal: controller.signal,
              throwHttpErrors: false,
              redirect: 'manual',
            });
            if (response.ok) {
              const parsed = schema.safeParse(
                await readGoogleJsonResponse(response, controller.signal),
              );
              if (!parsed.success)
                throw new GoogleProviderError(
                  'Google provider response did not match its schema.',
                  { code: 'GBP_MALFORMED_RESPONSE', status: 502, kind: 'malformed_response' },
                );
              return parsed.data;
            }
            if (
              options.retry === false ||
              method !== 'GET' ||
              attempt >= 2 ||
              !RETRYABLE_STATUSES.has(response.status)
            )
              throw providerError(response);
            const delay = Math.max(
              100 * 2 ** attempt * random(),
              retryAfterMs(response, now()) ?? 0,
            );
            if (delay > MAX_RETRY_DELAY_MS || now() + delay >= startedAt + TOTAL_DEADLINE_MS)
              throw providerError(response);
            await withinGoogleDeadline(sleep(delay, controller.signal), controller.signal);
          } catch (error) {
            if (error instanceof GoogleBusinessProfileError) throw error;
            if (controller.signal.aborted || now() >= startedAt + TOTAL_DEADLINE_MS) {
              throw new GoogleProviderError('Google provider request timed out.', {
                code: 'GBP_TIMEOUT',
                status: 504,
                kind: 'timeout',
              });
            }
            if (options.retry === false || method !== 'GET' || attempt >= 2)
              throw new GoogleProviderError('Google provider network request failed.', {
                code: 'GBP_UPSTREAM',
                status: 502,
                kind: 'upstream',
              });
            const delay = 100 * 2 ** attempt * random();
            if (now() + delay >= startedAt + TOTAL_DEADLINE_MS)
              throw new GoogleProviderError('Google provider request timed out.', {
                code: 'GBP_TIMEOUT',
                status: 504,
                kind: 'timeout',
              });
            await withinGoogleDeadline(sleep(delay, controller.signal), controller.signal);
          }
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export { readGoogleJsonResponse } from './responseBody';

export async function googleFetchJson<T>(
  urlValue: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(urlValue);
  if (!GOOGLE_ORIGINS.has(url.origin))
    throw new GoogleProviderError('Google provider origin is not allowed.', {
      code: 'GBP_INVALID_PROVIDER_ORIGIN',
      status: 500,
    });
  const schema = z.custom<T>();
  return createGoogleJsonTransport({
    origin: url.origin,
    accessToken,
    quotaProject: env.googleBusinessProfile.quotaProject,
  }).request(`${url.pathname.slice(1)}${url.search}`, schema, {
    method:
      init.method === 'POST' || init.method === 'PATCH' || init.method === 'DELETE'
        ? init.method
        : 'GET',
    headers: init.headers,
    json: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
  });
}
