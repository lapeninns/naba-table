'use client';

export const SESSION_EXPIRED_EVENT = 'session:expired';

// `/guest/bookings/<id>` and `/guest/bookings/<id>/receipt`: the same booking
// page gate as `/bookings/<id>`, reachable with the booking cookie alone (they
// are in the recover route's `next` allow-list).
const GUEST_BOOKING_COOKIE_PAGE = /^\/guest\/bookings\/[^/]+(?:\/receipt)?\/?$/;

/**
 * Pages a guest can reach with an emailed booking link instead of an account:
 * the public `/bookings`, `/bookings/<id>`, `/bookings/find`, plus the
 * `/guest/bookings/<id>` detail and receipt pages. A 401 there means the link
 * cookie expired and the page offers a new link, so a sign-in redirect is
 * wrong. The rest of `/guest/**` (signed-in guests, including the
 * `/guest/bookings` list) and `/app/**` (ops) keep the sign-in redirect.
 */
export function isGuestBookingLinkPath(pathname: string): boolean {
  return (
    pathname === '/bookings' ||
    pathname.startsWith('/bookings/') ||
    GUEST_BOOKING_COOKIE_PAGE.test(pathname)
  );
}

/** Whether a 401 from the current page should send the browser to sign-in. */
export function shouldRedirectToSignInOnUnauthenticated(): boolean {
  if (typeof window === 'undefined') return true;
  return !isGuestBookingLinkPath(window.location.pathname);
}

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
