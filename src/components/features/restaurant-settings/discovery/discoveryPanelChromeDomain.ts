import {
  SYNC_POSTURE,
  formatSeedSource,
  type FamilyKey,
  type SeedSource,
} from '../businessContextModel';

export const DISCOVERY_SAVE_BOUNDARIES: Record<FamilyKey, string> = {
  businessDetails: 'This saves profile basics only.',
  links: 'This saves discovery links only.',
  categories: 'This saves dining categories only.',
  serviceAreas: 'This saves service areas only.',
  attributes: 'This saves amenities only.',
  serviceItems: 'This saves services only.',
};

export type DiscoverySaveBoundaryState = {
  boundaryText: string;
  dirty: boolean;
  saved: boolean;
  hasError: boolean;
};

export function formatDiscoveryStatus({
  coreCount,
  providerCount,
  seedSource,
  gbpLinked,
}: {
  coreCount: number;
  providerCount: number;
  seedSource: SeedSource[FamilyKey];
  gbpLinked: boolean;
}): string {
  if (!gbpLinked) {
    return `Saved ${coreCount} · Connect Google Business Profile to import suggestions`;
  }
  if (providerCount === 0) {
    return `Saved ${coreCount} · No Google suggestions for this section`;
  }
  return `Saved ${coreCount} · Suggested ${providerCount} · ${formatSeedSource(
    seedSource,
    providerCount,
  )}`;
}

export function getDiscoverySyncPosture(family: FamilyKey): string {
  return SYNC_POSTURE[family];
}

export function buildDiscoverySaveBoundaryState({
  family,
  dirty,
  saved,
  hasError,
}: {
  family: FamilyKey;
  dirty: boolean;
  saved: boolean;
  hasError: boolean;
}): DiscoverySaveBoundaryState {
  return {
    boundaryText: DISCOVERY_SAVE_BOUNDARIES[family],
    dirty,
    saved,
    hasError,
  };
}
