import { randomUUID } from 'node:crypto';

import { logger } from '@/lib/logger';

export const LOGO_BUCKET_ID = 'restaurant-branding';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const LOGO_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set(Object.keys(EXTENSION_BY_MIME));

/**
 * A new object path for every upload, so the stored logo_url never points at bytes that
 * changed underneath it and a failed save leaves the current logo intact.
 */
export function buildVersionedLogoPath(
  restaurantId: string,
  mimeType: string,
): {
  path: string;
  version: string;
} {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'img';
  const version = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  return { path: `${restaurantId}/logo-${version}.${extension}`, version };
}

/**
 * The storage path of a logo URL, only when it is an object in this restaurant's folder of the
 * branding bucket. External URLs and other tenants' objects return null and are never deleted.
 */
export function logoStoragePathFromUrl(
  url: string | null | undefined,
  restaurantId: string,
): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const marker = `/object/public/${LOGO_BUCKET_ID}/`;
  const index = pathname.indexOf(marker);
  if (index === -1) return null;

  let path: string;
  try {
    path = decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
  const segments = path.split('/');
  if (
    segments.length !== 2 ||
    segments[0] !== restaurantId ||
    !segments[1] ||
    segments.some((segment) => segment === '..' || segment === '.')
  ) {
    return null;
  }
  return path;
}

type StorageRemover = {
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => PromiseLike<{ error: { message?: string } | null }>;
    };
  };
};

/** Best effort: a leftover object costs storage, never correctness, so failures are logged. */
export async function removeLogoObject(
  client: StorageRemover,
  path: string,
  ctx: { restaurantId: string; reason: 'replaced' | 'removed' | 'save_failed' },
): Promise<void> {
  try {
    const { error } = await client.storage.from(LOGO_BUCKET_ID).remove([path]);
    if (error) {
      logger.warn('ops.restaurants.logo.cleanup_failed', {
        route: 'ops.restaurants.logo',
        restaurantId: ctx.restaurantId,
        reason: ctx.reason,
      });
    }
  } catch {
    logger.warn('ops.restaurants.logo.cleanup_failed', {
      route: 'ops.restaurants.logo',
      restaurantId: ctx.restaurantId,
      reason: ctx.reason,
    });
  }
}
