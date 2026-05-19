import { normalizeOpsPathname } from '@/lib/url/opsHref';

export function isRestaurantSettingsPathname(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }

  const normalized = normalizeOpsPathname(pathname);
  return (
    normalized === '/settings/restaurant' || normalized.startsWith('/settings/restaurant/')
  );
}
