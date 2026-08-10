import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/app/dashboard',
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  setConfig: vi.fn(),
  optOut: vi.fn(),
  optIn: vi.fn(),
  stopRecording: vi.fn(),
}));

const posthogClient = {
  __loaded: true,
  config: {},
  init: mocks.init,
  capture: mocks.capture,
  identify: mocks.identify,
  reset: mocks.reset,
  set_config: mocks.setConfig,
  opt_out_capturing: mocks.optOut,
  opt_in_capturing: mocks.optIn,
  stopSessionRecording: mocks.stopRecording,
  debug: vi.fn(),
};

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('posthog-js', () => ({ default: posthogClient }));

vi.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
  usePostHog: () => posthogClient,
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => ({ user: null }),
}));

vi.mock('@/lib/env-client', () => ({
  clientEnv: {
    posthog: { enabled: true, key: 'phc_test', host: 'https://posthog.example.com' },
  },
}));

import {
  getPosthogCookieExpiryDomains,
  isSensitiveAnalyticsPath,
  PostHogProvider,
} from '@/lib/posthog/provider';

type AnalyticsWindow = Window & {
  posthog?: unknown;
  __posthogQueue?: Array<{ event: string; payload: Record<string, unknown> }>;
};

async function flushDeferredInit() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_500);
  });
}

describe('PostHog sensitive-path privacy boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.pathname = '/app/dashboard';
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = 'ph_test_posthog=; Max-Age=0; Path=/';
    delete (window as AnalyticsWindow).posthog;
    delete (window as AnalyticsWindow).__posthogQueue;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('classifies GBP and dual-sync settings paths without suppressing ordinary settings', () => {
    expect(isSensitiveAnalyticsPath('/app/settings/restaurant/google-business-profile')).toBe(true);
    expect(isSensitiveAnalyticsPath('/app/settings/restaurant/google-business-profile/menus')).toBe(
      true,
    );
    expect(isSensitiveAnalyticsPath('/app/settings/restaurant/dual-sync/jobs')).toBe(true);
    expect(isSensitiveAnalyticsPath('/app/settings/restaurant/details')).toBe(false);
  });

  it('returns exact safe cookie-expiry domains without crossing a public-suffix boundary', () => {
    expect(getPosthogCookieExpiryDomains('ops.nabatable.com')).toEqual([
      null,
      'ops.nabatable.com',
      'nabatable.com',
    ]);
    expect(getPosthogCookieExpiryDomains('admin.ops.nabatable.co.uk')).toEqual([
      null,
      'admin.ops.nabatable.co.uk',
      'ops.nabatable.co.uk',
      'nabatable.co.uk',
    ]);
    expect(getPosthogCookieExpiryDomains('localhost')).toEqual([null]);
    expect(getPosthogCookieExpiryDomains('127.0.0.1')).toEqual([null]);
  });

  it('does not initialize and clears prior identity/content persistence on a sensitive first path', async () => {
    mocks.pathname = '/app/settings/restaurant/google-business-profile';
    window.localStorage.setItem('ph_phc_test_posthog', '{"distinct_id":"user-1"}');
    window.sessionStorage.setItem('ph_phc_test_posthog', '{"session":"content"}');
    window.localStorage.setItem('unrelated', 'keep');
    document.cookie = 'ph_phc_test_posthog=identity; Path=/';
    (window as AnalyticsWindow).__posthogQueue = [
      { event: 'content_event', payload: { description: 'provider content' } },
    ];

    render(
      <PostHogProvider>
        <div>safe</div>
      </PostHogProvider>,
    );
    await flushDeferredInit();

    expect(mocks.init).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('ph_phc_test_posthog')).toBeNull();
    expect(window.sessionStorage.getItem('ph_phc_test_posthog')).toBeNull();
    expect(window.localStorage.getItem('unrelated')).toBe('keep');
    expect(document.cookie).not.toContain('ph_phc_test_posthog');
    expect((window as AnalyticsWindow).__posthogQueue).toEqual([]);
  });

  it('quarantines an initialized client on entry and safely restores ordinary analytics on exit', async () => {
    const view = render(
      <PostHogProvider>
        <div>safe</div>
      </PostHogProvider>,
    );
    await flushDeferredInit();

    expect(mocks.init).toHaveBeenCalledOnce();
    expect(mocks.init.mock.calls[0]?.[1]).toMatchObject({
      autocapture: true,
      capture_pageleave: true,
      cross_subdomain_cookie: false,
      persistence: 'localStorage+cookie',
    });
    const beforeSend = mocks.init.mock.calls[0]?.[1]?.before_send as
      | ((event: Record<string, unknown>) => unknown)
      | undefined;
    expect(beforeSend).toBeTypeOf('function');
    window.history.pushState({}, '', '/app/settings/restaurant/google-business-profile');
    expect(beforeSend?.({ event: 'content_event', properties: {} })).toBeNull();
    window.history.pushState({}, '', '/app/dashboard');
    expect(
      beforeSend?.({
        event: '$pageleave',
        properties: {
          $current_url: 'https://nabatable.example/app/settings/restaurant/google-business-profile',
        },
      }),
    ).toBeNull();

    window.localStorage.setItem('ph_phc_test_posthog', '{"distinct_id":"user-1"}');
    mocks.pathname = '/app/settings/restaurant/google-business-profile';
    view.rerender(
      <PostHogProvider>
        <div>sensitive</div>
      </PostHogProvider>,
    );

    expect(mocks.stopRecording).toHaveBeenCalledOnce();
    expect(mocks.reset).toHaveBeenCalled();
    expect(mocks.optOut).toHaveBeenCalledOnce();
    expect(mocks.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        autocapture: false,
        capture_pageleave: false,
        disable_session_recording: true,
        persistence: 'memory',
      }),
    );
    expect(window.localStorage.getItem('ph_phc_test_posthog')).toBeNull();

    mocks.pathname = '/app/settings/restaurant/details';
    view.rerender(
      <PostHogProvider>
        <div>ordinary</div>
      </PostHogProvider>,
    );

    expect(mocks.init).toHaveBeenCalledOnce();
    expect(mocks.optIn).toHaveBeenCalledOnce();
    expect(mocks.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        autocapture: true,
        capture_pageleave: true,
        disable_session_recording: false,
        persistence: 'localStorage+cookie',
      }),
    );
  });
});
