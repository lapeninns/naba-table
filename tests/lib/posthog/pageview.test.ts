import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PosthogTestWindow = Window & {
  posthog?: {
    capture: ReturnType<typeof vi.fn>;
  };
  __posthogQueue?: Array<{ event: string; payload: Record<string, unknown> }>;
  __nabatablePosthogInitialPageviewCaptured?: boolean;
  __nabatablePosthogLastPageviewUrl?: string;
};

describe('PostHog pageviews', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
    vi.resetModules();
    window.history.replaceState({}, '', '/restaurants');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const win = window as PosthogTestWindow;
    delete win.posthog;
    delete win.__posthogQueue;
    delete win.__nabatablePosthogInitialPageviewCaptured;
    delete win.__nabatablePosthogLastPageviewUrl;
  });

  it('captures the first hard-load pageview once', async () => {
    const capture = vi.fn();
    (window as PosthogTestWindow).posthog = { capture };

    await import('../../../src/instrumentation-client');

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$pageview', {
      $current_url: expect.stringContaining('/restaurants'),
    });
  });

  it('captures public router-transition pageviews once', async () => {
    const capture = vi.fn();
    (window as PosthogTestWindow).posthog = { capture };

    const instrumentation = await import('../../../src/instrumentation-client');
    capture.mockClear();

    instrumentation.onRouterTransitionStart('/restaurants?source=nav');
    instrumentation.onRouterTransitionStart('/restaurants?source=nav');
    instrumentation.onRouterTransitionStart('/restaurants?source=nav#reviews');

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$pageview', {
      $current_url: expect.stringContaining('/restaurants?source=nav'),
    });
  });

  it('captures app-host router-transition pageviews', async () => {
    const capture = vi.fn();
    (window as PosthogTestWindow).posthog = { capture };

    const instrumentation = await import('../../../src/instrumentation-client');
    capture.mockClear();

    instrumentation.onRouterTransitionStart(
      'http://app.localhost:3000/settings/restaurant/profile',
    );

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$pageview', {
      $current_url: 'http://app.localhost:3000/settings/restaurant/profile',
    });
  });

  it('captures root-host app transport pageviews', async () => {
    const capture = vi.fn();
    (window as PosthogTestWindow).posthog = { capture };

    const instrumentation = await import('../../../src/instrumentation-client');
    capture.mockClear();

    instrumentation.onRouterTransitionStart('/app/settings/restaurant/profile');

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$pageview', {
      $current_url: expect.stringContaining('/app/settings/restaurant/profile'),
    });
  });
});
