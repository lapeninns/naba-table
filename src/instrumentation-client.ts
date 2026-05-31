// This file configures client-side analytics instrumentation.
import { clientEnv } from '@/lib/env-client';
import { stripUrlQueryAndHash } from '@/lib/security/url-redaction';

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

type RouterTransitionTarget = { to?: string; url?: string; pathname?: string } | string | undefined;

const getRouterTargetUrl = (args: unknown[]): URL | null => {
  const candidate = args[0] as RouterTransitionTarget;
  if (typeof candidate === 'string') return resolveUrl(candidate);
  if (candidate && typeof candidate === 'object') {
    return resolveUrl(candidate.to ?? candidate.url ?? candidate.pathname);
  }
  return null;
};

// PostHog is initialized in the client provider to defer work off the critical path.
const posthogConfig = clientEnv.posthog;
const INITIAL_PAGEVIEW_WINDOW_KEY = '__nabatablePosthogInitialPageviewCaptured';
const LAST_PAGEVIEW_URL_WINDOW_KEY = '__nabatablePosthogLastPageviewUrl';

type PosthogQueuedEvent = { event: string; payload: Record<string, unknown> };

const getPosthogPageviewUrl = (url: URL) => stripUrlQueryAndHash(url.href);
const getPageviewKey = (url: URL) => getPosthogPageviewUrl(url);

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
  const win = window as Window & {
    __posthogQueue?: PosthogQueuedEvent[];
    posthog?: { capture: (event: string, payload: Record<string, unknown>) => void };
  };
  if (!win.posthog || !win.__posthogQueue || win.__posthogQueue.length === 0) {
    return;
  }
  const batch = win.__posthogQueue.splice(0, win.__posthogQueue.length);
  batch.forEach(({ event, payload }) => {
    win.posthog?.capture(event, payload);
  });
};

const capturePosthogPageview = (targetUrl?: URL | null): boolean => {
  if (!posthogConfig.enabled) return false;
  if (typeof window === 'undefined') return false;
  const resolvedTargetUrl = targetUrl ?? resolveUrl();
  if (!resolvedTargetUrl) return false;

  const win = window as Window & {
    posthog?: { capture: (event: string, payload: Record<string, unknown>) => void };
    [LAST_PAGEVIEW_URL_WINDOW_KEY]?: string;
  };
  const pageviewKey = getPageviewKey(resolvedTargetUrl);
  if (win[LAST_PAGEVIEW_URL_WINDOW_KEY] === pageviewKey) return false;
  win[LAST_PAGEVIEW_URL_WINDOW_KEY] = pageviewKey;

  if (win.posthog) {
    flushPosthogQueue();
    win.posthog.capture('$pageview', {
      $current_url: getPosthogPageviewUrl(resolvedTargetUrl),
    });
    return true;
  }

  const queue = getPosthogQueue();
  queue?.push({
    event: '$pageview',
    payload: { $current_url: getPosthogPageviewUrl(resolvedTargetUrl) },
  });
  return true;
};

export const captureInitialPosthogPageview = () => {
  if (typeof window === 'undefined') return;
  const win = window as Window & { [INITIAL_PAGEVIEW_WINDOW_KEY]?: boolean };
  if (win[INITIAL_PAGEVIEW_WINDOW_KEY]) return;
  const captured = capturePosthogPageview();
  if (captured) {
    win[INITIAL_PAGEVIEW_WINDOW_KEY] = true;
  }
};

// Capture pageview on route transition
export const onRouterTransitionStart = (...args: unknown[]) => {
  const targetUrl = getRouterTargetUrl(args);
  capturePosthogPageview(targetUrl);
};

captureInitialPosthogPageview();
