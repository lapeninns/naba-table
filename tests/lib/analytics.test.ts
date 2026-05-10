import { afterEach, describe, expect, it, vi } from 'vitest';

describe('track', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (window as Window & { posthog?: unknown }).posthog;
    delete (window as Window & { __posthogQueue?: unknown }).__posthogQueue;
  });

  it('captures a PostHog custom event once', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
    const capture = vi.fn();
    (window as Window & { posthog?: { capture: typeof capture } }).posthog = { capture };

    const { track } = await import('@/lib/analytics');

    track('restaurant_selected', {
      restaurantId: 'restaurant-1',
      email: 'guest@example.com',
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('restaurant_selected', {
      restaurantId: 'restaurant-1',
    });
  });
});
