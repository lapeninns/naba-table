// This file configures client-side analytics instrumentation.
import { clientEnv } from '@/lib/env-client';

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

const capturePosthogPageview = (targetUrl?: URL | null) => {
  if (!posthogConfig.enabled) return;
  if (typeof window === 'undefined') return;
  const resolvedTargetUrl = targetUrl ?? resolveUrl();
  if (!resolvedTargetUrl || isOpsUrl(resolvedTargetUrl)) return;
  const win = window as Window & { posthog?: { capture: (event: string, payload: Record<string, unknown>) => void } };
  if (win.posthog) {
    flushPosthogQueue();
    win.posthog.capture('$pageview', {
      $current_url: resolvedTargetUrl.href,
    });
    return;
  }

  const queue = getPosthogQueue();
  queue?.push({
    event: '$pageview',
    payload: { $current_url: resolvedTargetUrl.href },
  });
};

// Capture pageview on route transition
export const onRouterTransitionStart = (...args: unknown[]) => {
  const targetUrl = getRouterTargetUrl(args);
  capturePosthogPageview(targetUrl);
};
