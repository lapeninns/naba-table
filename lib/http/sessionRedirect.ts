'use client';

export const SESSION_EXPIRED_EVENT = 'session:expired';

let redirectInFlight = false;
let lastPath: string | null = null;
let lastSignalTs = 0;
const SIGNAL_DEBOUNCE_MS = 1500;

export function triggerSessionRedirect(path?: string, message?: string) {
  if (typeof window === 'undefined') return;

  const currentPath = path ?? `${window.location.pathname}${window.location.search}`;
  if (!currentPath || currentPath.startsWith('/auth')) return;

  if (redirectInFlight && lastPath === currentPath) return;

  const now = Date.now();
  if (now - lastSignalTs > SIGNAL_DEBOUNCE_MS) {
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, {
        detail: {
          message: message ?? 'Please sign in again to continue.',
          path: currentPath,
        },
      }),
    );
    lastSignalTs = now;
  }

  const target = `/auth/signin?redirectedFrom=${encodeURIComponent(currentPath)}`;
  redirectInFlight = true;
  lastPath = currentPath;
  window.location.assign(target);
}
