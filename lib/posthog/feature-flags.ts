import { isServerFeatureEnabled } from '@/lib/posthog/server';

/**
 * PostHog-evaluated server feature flags with a deterministic local fallback.
 *
 * These keys are the canonical PostHog flag names. The `KnownServerFlag` union
 * gives compile-time allowlisting (mirrors `AnalyticsEvent`) so typos cannot
 * silently evaluate an undefined flag.
 *
 * This module stays framework-agnostic (no React/Next imports) so it can run in
 * route handlers, `server/` jobs, and CLI scripts.
 */
export type KnownServerFlag =
  | 'reserve-v2'
  | 'new-booking-wizard'
  | 'ops-table-assignment-v2'
  | 'gbp-dual-sync-rollout'
  | 'sms-delivery-rollout';

export type FeatureFallbackOptions = {
  /** Stable Supabase user id when available; omit for anonymous/system contexts. */
  distinctId?: string | null;
  /** PostHog group analytics keys, e.g. `{ restaurant: restaurantId }`. */
  groups?: Record<string, string>;
  /**
   * Local/env-derived value used when PostHog is not configured or evaluation
   * fails. Callers should pass the existing `env.featureFlags` value so behavior
   * is preserved when the PostHog flag is unset. Defaults to `false`.
   */
  fallback?: boolean;
};

/**
 * Returns the PostHog value for `key` when the server client is configured and
 * the flag evaluates successfully; otherwise returns the caller-supplied
 * `fallback` (the existing env/local flag value). PostHog always wins when
 * available, so this is a non-breaking overlay on top of local flags.
 */
export async function isFeatureEnabledWithFallback(
  key: KnownServerFlag,
  options: FeatureFallbackOptions = {},
): Promise<boolean> {
  return isServerFeatureEnabled(key, {
    distinctId: options.distinctId ?? undefined,
    groups: options.groups,
    fallback: options.fallback ?? false,
  });
}
