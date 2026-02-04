// This file configures the initialization of Sentry and PostHog on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const isOpsPath = (path: string) => path.startsWith('/app');
const isOpsHost = (host: string) => host.startsWith('app.');

const resolveUrl = (value?: string | URL | null): URL | null => {
  if (typeof window === 'undefined') return null;
  if (!value) return new URL(window.location.href);
  if (value instanceof URL) return value;
  try {
    return new URL(value, window.location.origin);
  } catch {
    return null;
  }
};

const isOpsUrl = (value?: string | URL | null) => {
  const resolved = resolveUrl(value);
  if (!resolved) return false;
  return isOpsPath(resolved.pathname) || isOpsHost(resolved.hostname);
};

const getRouterTargetUrl = (
  args: Parameters<typeof Sentry.captureRouterTransitionStart>,
): URL | null => {
  const candidate = args[0] as { to?: string; url?: string; pathname?: string } | string | undefined;
  if (typeof candidate === 'string') return resolveUrl(candidate);
  if (candidate && typeof candidate === 'object') {
    return resolveUrl(candidate.to ?? candidate.url ?? candidate.pathname);
  }
  return null;
};

const updateReplayForUrl = (value?: string | URL | null) => {
  const replay = Sentry.getReplay?.();
  if (!replay) return;
  if (isOpsUrl(value)) {
    replay.stop?.();
    return;
  }
  if (replay.isEnabled?.() === false) {
    replay.start?.();
  }
};

// Initialize Sentry
Sentry.init({
  dsn: 'https://1488f284160e83bd738cf606f0ccf826@o4510764192497664.ingest.de.sentry.io/4510764200034384',

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

if (typeof window !== 'undefined') {
  updateReplayForUrl();
}

// PostHog is initialized in the client provider to defer work off the critical path.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

type PosthogQueuedEvent = { event: string; payload: Record<string, unknown> };

const getPosthogQueue = () => {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { __posthogQueue?: PosthogQueuedEvent[] };
  if (!win.__posthogQueue) {
    win.__posthogQueue = [];
  }
  return win.__posthogQueue;
};

const flushPosthogQueue = () => {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __posthogQueue?: PosthogQueuedEvent[]; posthog?: { capture: (event: string, payload: Record<string, unknown>) => void } };
  if (!win.posthog || !win.__posthogQueue || win.__posthogQueue.length === 0) {
    return;
  }
  const batch = win.__posthogQueue.splice(0, win.__posthogQueue.length);
  batch.forEach(({ event, payload }) => {
    win.posthog?.capture(event, payload);
  });
};

const capturePosthogPageview = () => {
  if (!posthogKey || !posthogHost) return;
  if (isOpsUrl()) return;
  if (typeof window === 'undefined') return;
  const win = window as Window & { posthog?: { capture: (event: string, payload: Record<string, unknown>) => void } };
  if (win.posthog) {
    flushPosthogQueue();
    win.posthog.capture('$pageview', {
      $current_url: window.location.href,
    });
    return;
  }

  const queue = getPosthogQueue();
  queue?.push({
    event: '$pageview',
    payload: { $current_url: window.location.href },
  });
};

// Capture pageview on route transition
export const onRouterTransitionStart: typeof Sentry.captureRouterTransitionStart = (
  ...args
) => {
  Sentry.captureRouterTransitionStart(...args);

  const targetUrl = getRouterTargetUrl(args);
  if (targetUrl) {
    updateReplayForUrl(targetUrl);
  } else if (typeof window !== 'undefined') {
    window.setTimeout(() => updateReplayForUrl(), 0);
  }

  // Capture pageview in PostHog
  capturePosthogPageview();
};
