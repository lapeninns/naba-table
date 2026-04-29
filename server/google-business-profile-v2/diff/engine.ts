/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Deterministic V2 diff engine. Given two `SyncV2CanonicalSnapshot`s (from
 * the Nabatable and Google sides), it returns the full ordered list of
 * `SyncV2DiffItem`s. Per-section adapters do all the per-section work; this
 * file is just composition + ordering.
 */

import { SYNC_V2_SECTION_KEYS, type SyncV2SectionKey } from '../types';
import { diffBusinessContextAttributes } from './sections/business-context-attributes';
import { diffBusinessContextCategories } from './sections/business-context-categories';
import { diffBusinessContextServiceAreas } from './sections/business-context-service-areas';
import { diffBusinessContextServiceItems } from './sections/business-context-service-items';
import { diffOperatingHours } from './sections/operating-hours';
import { diffProfile } from './sections/profile';
import { diffServicePeriods } from './sections/service-periods';

import type { SyncV2CanonicalSnapshot } from '../snapshot/types';
import type { SyncV2DiffItem } from '../types';

export interface BuildDiffInput {
  readonly nabatable: SyncV2CanonicalSnapshot;
  readonly google: SyncV2CanonicalSnapshot;
}

export interface BuildDiffOutput {
  readonly items: ReadonlyArray<SyncV2DiffItem>;
  /** Items per section (preserves engine ordering). */
  readonly bySection: Record<SyncV2SectionKey, ReadonlyArray<SyncV2DiffItem>>;
}

export function buildSyncV2Diff({ nabatable, google }: BuildDiffInput): BuildDiffOutput {
  const profile = diffProfile(nabatable.profile, google.profile);
  const operatingHours = diffOperatingHours(nabatable.operatingHours, google.operatingHours);
  const servicePeriods = diffServicePeriods(nabatable.servicePeriods, google.servicePeriods);
  const categories = diffBusinessContextCategories(
    nabatable.businessContext.categories,
    google.businessContext.categories,
  );
  const serviceAreas = diffBusinessContextServiceAreas(
    nabatable.businessContext.serviceAreas,
    google.businessContext.serviceAreas,
  );
  const attributes = diffBusinessContextAttributes(
    nabatable.businessContext.attributes,
    google.businessContext.attributes,
  );
  const serviceItems = diffBusinessContextServiceItems(
    nabatable.businessContext.serviceItems,
    google.businessContext.serviceItems,
  );

  const bySection = {
    profile,
    operatingHours,
    servicePeriods,
    'businessContext.categories': categories,
    'businessContext.serviceAreas': serviceAreas,
    'businessContext.attributes': attributes,
    'businessContext.serviceItems': serviceItems,
  } satisfies Record<SyncV2SectionKey, ReadonlyArray<SyncV2DiffItem>>;

  // Engine order: section order from SYNC_V2_SECTION_KEYS, sortOrder within
  // each section as set by the adapter.
  const items: SyncV2DiffItem[] = [];
  for (const key of SYNC_V2_SECTION_KEYS) {
    items.push(...bySection[key]);
  }

  return { items, bySection };
}
