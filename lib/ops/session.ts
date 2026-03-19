import { resolveCookieDomain } from '@/lib/supabase/cookies';

export const OPS_ACTIVE_RESTAURANT_STORAGE_KEY = 'ops.activeRestaurantId';
export const OPS_ACTIVE_RESTAURANT_COOKIE_NAME = 'ops-active-restaurant';

const OPS_ACTIVE_RESTAURANT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function deriveRootDomain(hostname: string): string | undefined {
  if (!hostname || hostname === 'localhost' || hostname.startsWith('127.')) {
    return undefined;
  }

  const parts = hostname.split('.');
  if (parts.length < 2) {
    return undefined;
  }

  return parts.slice(-2).join('.');
}

function resolveBrowserRootDomain(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const configuredRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  if (configuredRootDomain && configuredRootDomain !== 'localhost') {
    return configuredRootDomain;
  }

  return deriveRootDomain(window.location.hostname);
}

export function resolvePreferredOpsRestaurantId(
  restaurantIds: readonly string[],
  preferredRestaurantId?: string | null,
): string | null {
  if (preferredRestaurantId && restaurantIds.includes(preferredRestaurantId)) {
    return preferredRestaurantId;
  }

  return restaurantIds[0] ?? null;
}

export function writeBrowserOpsRestaurantCookie(restaurantId: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;
  const rootDomain = resolveBrowserRootDomain();
  const resolvedDomain = resolveCookieDomain(rootDomain);
  const maxAge = restaurantId ? OPS_ACTIVE_RESTAURANT_MAX_AGE_SECONDS : 0;
  const encodedValue = restaurantId ? encodeURIComponent(restaurantId) : '';
  const attributes = [
    `max-age=${maxAge}`,
    'path=/',
    'samesite=lax',
    resolvedDomain ? `domain=${resolvedDomain}` : null,
    secure ? 'secure' : null,
  ]
    .filter(Boolean)
    .join('; ');

  document.cookie = `${OPS_ACTIVE_RESTAURANT_COOKIE_NAME}=${encodedValue}; ${attributes}`;
}
