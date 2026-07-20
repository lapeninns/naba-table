import { after } from 'next/server';
import { PostHog } from 'posthog-node';

import { type AnalyticsEvent } from '@/lib/analytics';
import { sanitizeAnalyticsProps, type AnalyticsProps } from '@/lib/analytics/schema';
import { sanitizeLogText } from '@/lib/logger';
import {
  getActiveTraceCorrelation,
  sanitizeCorrelationId,
} from '@/lib/observability/request-correlation';

type PostHogServerClient = Pick<PostHog, 'capture' | 'captureException' | 'flush' | 'shutdown'> &
  Partial<Pick<PostHog, 'captureExceptionImmediate'>>;

export type ServerPostHogCaptureOptions = {
  distinctId?: string | null;
  groups?: Record<string, string>;
  properties?: Record<string, unknown>;
  /**
   * Privacy-safe request correlation id (trace id, sanitized request id, or
   * attempt id). Sanitized again defensively before being attached.
   */
  correlationId?: string | null;
};

let serverPosthogClient: PostHogServerClient | null | undefined;

const normalizeHost = (host: string): string => host.replace(/\/$/, '');

export function getPosthogServerConfig() {
  const key = process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null;
  const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? null;
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY ?? null;

  return {
    key,
    host: host ? normalizeHost(host) : null,
    personalApiKey,
    enabled: Boolean(key && host),
  } as const;
}

/**
 * Release metadata attached to every server exception so PostHog error
 * tracking can associate events with the uploaded source-map release
 * (`nabatable-web`) and the deployed commit.
 */
export function getPosthogServerReleaseMetadata() {
  return {
    release: 'nabatable-web',
    deploySha:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_APP_VERSION ??
      'unknown',
  } as const;
}

function getServerDistinctId() {
  const envName =
    process.env.VERCEL_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown';
  return `server:${envName}`;
}

/**
 * Keeps the serverless invocation alive until `promise` settles by handing it
 * to Next.js `after()`. Outside a request scope (unit tests, scripts) `after`
 * throws synchronously; the promise still runs in-process there.
 */
function keepAliveAfterResponse(promise: Promise<unknown>): void {
  try {
    after(promise);
  } catch {
    // Not in a request scope; long-lived processes settle the promise anyway.
  }
}

export function getPosthogServerClient(): PostHogServerClient | null {
  if (serverPosthogClient !== undefined) return serverPosthogClient;

  const config = getPosthogServerConfig();
  if (!config.enabled || !config.key || !config.host) {
    serverPosthogClient = null;
    return serverPosthogClient;
  }

  serverPosthogClient = new PostHog(config.key, {
    host: config.host,
    personalApiKey: config.personalApiKey ?? undefined,
    flushAt: 20,
    flushInterval: 10_000,
    enableExceptionAutocapture: true,
    privacyMode: true,
    evaluationContexts: ['backend', process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown'],
    // Serverless-safe delivery: every enqueue schedules a debounced flush whose
    // completion promise is handed to Next.js `after()`, so the function stays
    // alive until the batch is sent instead of freezing with a full queue.
    waitUntil: (promise) => {
      after(promise);
    },
  });

  return serverPosthogClient;
}

export function captureServerEvent(
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
  options: ServerPostHogCaptureOptions = {},
): boolean {
  const client = getPosthogServerClient();
  if (!client) return false;

  const sanitizedProps = sanitizeAnalyticsProps({
    ...props,
    ...options.properties,
  });

  client.capture({
    distinctId: options.distinctId ?? getServerDistinctId(),
    event,
    properties: withCorrelation(sanitizedProps ?? {}, options.correlationId),
    groups: options.groups,
  });

  return true;
}

/**
 * Convenience wrapper for server events tied to a restaurant. Sets the PostHog
 * `restaurant` group (group analytics) and includes `restaurantId` as an
 * allowlisted property. distinctId is omitted for anonymous/system contexts,
 * which falls back to the privacy-safe `server:<env>` id.
 */
export function captureRestaurantServerEvent(
  event: AnalyticsEvent,
  {
    restaurantId,
    distinctId,
    props,
    correlationId,
  }: {
    restaurantId?: string | null;
    distinctId?: string | null;
    props?: Record<string, unknown>;
    correlationId?: string | null;
  } = {},
): boolean {
  return captureServerEvent(event, props, {
    distinctId: distinctId ?? undefined,
    groups: restaurantId ? { restaurant: restaurantId } : undefined,
    properties: restaurantId ? { restaurantId } : undefined,
    correlationId,
  });
}

/**
 * Returns an Error clone with the logger's string redactions applied to the
 * message and stack, so PostHog never receives emails, phone numbers, tokens,
 * or query strings embedded in exception text. Non-Error values pass through
 * (strings sanitized).
 */
export function sanitizeExceptionForCapture(error: unknown): unknown {
  if (error instanceof Error) {
    const sanitized = new Error(sanitizeLogText(error.message));
    sanitized.name = error.name;
    sanitized.stack =
      typeof error.stack === 'string' ? sanitizeLogText(error.stack) : error.stack;
    return sanitized;
  }
  if (typeof error === 'string') {
    return sanitizeLogText(error);
  }
  return error;
}

function withCorrelation(
  props: Record<string, unknown>,
  correlationId?: string | null,
): Record<string, unknown> {
  const active = getActiveTraceCorrelation();
  const sanitizedCorrelation =
    sanitizeCorrelationId(correlationId) ?? (active ? active.traceId : null);

  return {
    ...props,
    ...(sanitizedCorrelation ? { correlationId: sanitizedCorrelation } : {}),
    ...(active ? { traceId: active.traceId, spanId: active.spanId } : {}),
  };
}

/**
 * Captures a server-side exception as a native PostHog `$exception` event.
 *
 * Delivery is serverless-safe: the event is built and sent immediately on a
 * background promise which is handed to Next.js `after()`, so the response is
 * never blocked and the invocation is not frozen before the exception reaches
 * PostHog. The error message/stack are sanitized, and release metadata plus a
 * correlation id are attached so exceptions can be joined to logs and events.
 */
export function captureServerException(
  error: unknown,
  options: ServerPostHogCaptureOptions = {},
): boolean {
  const client = getPosthogServerClient();
  if (!client) return false;

  const sanitizedProps = sanitizeAnalyticsProps(options.properties) ?? {};
  const enrichedProps: Record<string, unknown> = {
    ...withCorrelation(sanitizedProps, options.correlationId),
    ...getPosthogServerReleaseMetadata(),
  };
  const exceptionProps = options.groups
    ? { ...enrichedProps, $groups: options.groups }
    : enrichedProps;

  const sanitizedError = sanitizeExceptionForCapture(error);
  const distinctId = options.distinctId ?? getServerDistinctId();

  if (typeof client.captureExceptionImmediate === 'function') {
    const pending = client
      .captureExceptionImmediate(sanitizedError, distinctId, exceptionProps)
      .catch((deliveryError: unknown) => {
        console.warn('[posthog] server exception delivery failed', {
          error: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
        });
      });
    keepAliveAfterResponse(pending);
  } else {
    client.captureException(sanitizedError, distinctId, exceptionProps);
    flushPosthogServerAfterResponse();
  }

  return true;
}

export async function flushPosthogServerClient(): Promise<void> {
  const client = getPosthogServerClient();
  if (!client) return;
  await client.flush();
}

/**
 * Schedules a PostHog flush after the response is sent. Prefer this from route
 * handlers over awaiting `flushPosthogServerClient()` inline: it never blocks
 * the response and still guarantees delivery before a serverless freeze. Safe
 * to call outside a request scope (no-op there).
 */
export function flushPosthogServerAfterResponse(): void {
  try {
    after(async () => {
      await flushPosthogServerClient();
    });
  } catch {
    // Not in a request scope; batching flush timers handle delivery.
  }
}

export function shutdownPosthogServerClient(timeoutMs = 5_000): void {
  const client = getPosthogServerClient();
  if (!client) return;
  client.shutdown(timeoutMs);
  serverPosthogClient = undefined;
}

export function resetPosthogServerClientForTests(client?: PostHogServerClient | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetPosthogServerClientForTests is test-only');
  }
  serverPosthogClient = client;
}

export type { AnalyticsProps };
