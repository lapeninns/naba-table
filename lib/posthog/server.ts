import { PostHog } from 'posthog-node';

import { type AnalyticsEvent } from '@/lib/analytics';
import { sanitizeAnalyticsProps, type AnalyticsProps } from '@/lib/analytics/schema';

type PostHogServerClient = Pick<
  PostHog,
  | 'capture'
  | 'captureException'
  | 'flush'
  | 'getFeatureFlagResult'
  | 'isFeatureEnabled'
  | 'shutdown'
>;

export type ServerPostHogCaptureOptions = {
  distinctId?: string | null;
  groups?: Record<string, string>;
  properties?: Record<string, unknown>;
};

export type ServerPostHogFlagOptions = {
  distinctId?: string | null;
  groups?: Record<string, string>;
  personProperties?: Record<string, string>;
  groupProperties?: Record<string, Record<string, string>>;
  fallback?: boolean;
};

export type ServerPostHogFlagValue = boolean | string | undefined;

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

function getServerDistinctId() {
  const envName =
    process.env.VERCEL_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown';
  return `server:${envName}`;
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
    properties: sanitizedProps,
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
  }: {
    restaurantId?: string | null;
    distinctId?: string | null;
    props?: Record<string, unknown>;
  } = {},
): boolean {
  return captureServerEvent(event, props, {
    distinctId: distinctId ?? undefined,
    groups: restaurantId ? { restaurant: restaurantId } : undefined,
    properties: restaurantId ? { restaurantId } : undefined,
  });
}

export function captureServerException(
  error: unknown,
  options: ServerPostHogCaptureOptions = {},
): boolean {
  const client = getPosthogServerClient();
  if (!client) return false;

  const sanitizedProps = sanitizeAnalyticsProps(options.properties) ?? {};
  const exceptionProps = options.groups
    ? { ...sanitizedProps, $groups: options.groups }
    : sanitizedProps;
  client.captureException(error, options.distinctId ?? getServerDistinctId(), exceptionProps);
  return true;
}

export async function isServerFeatureEnabled(
  key: string,
  options: ServerPostHogFlagOptions = {},
): Promise<boolean> {
  const client = getPosthogServerClient();
  const fallback = options.fallback ?? false;
  if (!client) return fallback;

  try {
    return (
      (await client.isFeatureEnabled(key, options.distinctId ?? getServerDistinctId(), {
        groups: options.groups,
        personProperties: options.personProperties,
        groupProperties: options.groupProperties,
      })) ?? fallback
    );
  } catch {
    return fallback;
  }
}

export async function getServerFeatureFlag(
  key: string,
  options: ServerPostHogFlagOptions = {},
): Promise<ServerPostHogFlagValue> {
  const client = getPosthogServerClient();
  if (!client) return options.fallback ?? false;

  try {
    const result = await client.getFeatureFlagResult(
      key,
      options.distinctId ?? getServerDistinctId(),
      {
        groups: options.groups,
        personProperties: options.personProperties,
        groupProperties: options.groupProperties,
      },
    );
    return result?.variant ?? result?.enabled ?? options.fallback ?? false;
  } catch {
    return options.fallback ?? false;
  }
}

export async function flushPosthogServerClient(): Promise<void> {
  const client = getPosthogServerClient();
  if (!client) return;
  await client.flush();
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
