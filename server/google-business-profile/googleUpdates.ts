import { z } from 'zod';

import { createGoogleJsonTransport, type GoogleTransportDependencies } from './clientTransport';
import { GoogleBusinessProfileError } from './errors';
import { googleAttributesSchema, googleLocationSchema } from './providerSchemas';

const BUSINESS_INFORMATION_ORIGIN = 'https://mybusinessbusinessinformation.googleapis.com';
const KNOWN_ROOTS = new Set([
  'title',
  'profile',
  'phoneNumbers',
  'storefrontAddress',
  'regularHours',
  'specialHours',
  'moreHours',
  'categories',
  'serviceArea',
  'serviceItems',
  'menus',
  'attributes',
]);

export const googleUpdatedLocationSchema = z
  .object({
    location: googleLocationSchema,
    diffMask: z.string(),
    pendingMask: z.string(),
  })
  .passthrough();

export const googleUpdatedAttributesSchema = googleAttributesSchema.extend({
  diffMask: z.string().optional(),
  pendingMask: z.string().optional(),
});

export type NormalizedGoogleMasks =
  | { readonly kind: 'known'; readonly masks: readonly string[] }
  | {
      readonly kind: 'unknown';
      readonly masks: readonly [];
      readonly unknownPaths: readonly string[];
    };

export function masksOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}

export function normalizeGoogleUpdateMasks(paths: readonly string[]): NormalizedGoogleMasks {
  const normalizedPaths = paths.map((path) => path.trim()).filter(Boolean);
  const unknownPaths = normalizedPaths.filter((path) => !KNOWN_ROOTS.has(path.split('.')[0] ?? ''));
  if (unknownPaths.length > 0) {
    return { kind: 'unknown', masks: [], unknownPaths: [...new Set(unknownPaths)].sort() };
  }
  return { kind: 'known', masks: [...new Set(normalizedPaths)].sort() };
}

function splitMask(mask: string | undefined): readonly string[] {
  return (
    mask
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  );
}

function requireReadMask(readMask: readonly string[]): string {
  const normalized = normalizeGoogleUpdateMasks(readMask);
  if (normalized.kind === 'unknown' || normalized.masks.length === 0) {
    throw new GoogleBusinessProfileError('A supported Google Updates read mask is required.', {
      code: 'GBP_GOOGLE_UPDATE_READ_MASK_INVALID',
      status: 500,
    });
  }
  return normalized.masks.join(',');
}

export function createGoogleUpdatesClient(config: {
  readonly accessToken: string;
  readonly quotaProject?: string | null;
  readonly dependencies?: GoogleTransportDependencies;
  readonly clock?: () => string;
}) {
  const transport = createGoogleJsonTransport({
    origin: BUSINESS_INFORMATION_ORIGIN,
    accessToken: config.accessToken,
    quotaProject: config.quotaProject,
    ...config.dependencies,
  });
  return {
    async getLocation(locationId: string, readMask: readonly string[]) {
      const response = await transport.request(
        `v1/locations/${encodeURIComponent(locationId)}:getGoogleUpdated`,
        googleUpdatedLocationSchema,
        { searchParams: { readMask: requireReadMask(readMask) } },
      );
      return {
        location: response.location ?? {},
        diffMask: normalizeGoogleUpdateMasks(splitMask(response.diffMask)),
        pendingMask: normalizeGoogleUpdateMasks(splitMask(response.pendingMask)),
      };
    },
    async getAttributes(locationId: string) {
      const response = await transport.request(
        `v1/locations/${encodeURIComponent(locationId)}/attributes:getGoogleUpdated`,
        googleUpdatedAttributesSchema,
      );
      return {
        attributes: response.attributes ?? [],
        diffMask: normalizeGoogleUpdateMasks(splitMask(response.diffMask)),
        pendingMask: normalizeGoogleUpdateMasks(splitMask(response.pendingMask)),
      };
    },
    async observe(locationId: string, readMask: readonly string[]) {
      const location = await this.getLocation(locationId, readMask);
      const attributes = await this.getAttributes(locationId);
      return {
        observedAt: config.clock?.() ?? new Date().toISOString(),
        location,
        attributes,
      };
    },
  };
}
