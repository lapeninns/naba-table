import { afterEach, describe, expect, it, vi } from 'vitest';

import { isFeatureEnabledWithFallback } from '@/lib/posthog/feature-flags';
import { resetPosthogServerClientForTests } from '@/lib/posthog/server';

describe('isFeatureEnabledWithFallback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetPosthogServerClientForTests();
  });

  it('returns the PostHog value when the client is configured', async () => {
    resetPosthogServerClientForTests({
      capture: vi.fn(),
      captureException: vi.fn(),
      flush: vi.fn(),
      getFeatureFlagResult: vi.fn(),
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn(),
    });

    await expect(
      isFeatureEnabledWithFallback('ops-table-assignment-v2', {
        distinctId: 'user-1',
        groups: { restaurant: 'restaurant-1' },
        fallback: false,
      }),
    ).resolves.toBe(true);
  });

  it('falls back to the caller-supplied local value when no client is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', '');
    resetPosthogServerClientForTests(null);

    await expect(isFeatureEnabledWithFallback('reserve-v2', { fallback: true })).resolves.toBe(
      true,
    );
    await expect(isFeatureEnabledWithFallback('reserve-v2')).resolves.toBe(false);
  });

  it('returns the fallback when PostHog evaluation throws', async () => {
    resetPosthogServerClientForTests({
      capture: vi.fn(),
      captureException: vi.fn(),
      flush: vi.fn(),
      getFeatureFlagResult: vi.fn(),
      isFeatureEnabled: vi.fn().mockRejectedValue(new Error('flag failed')),
      shutdown: vi.fn(),
    });

    await expect(
      isFeatureEnabledWithFallback('sms-delivery-rollout', { fallback: true }),
    ).resolves.toBe(true);
  });
});
