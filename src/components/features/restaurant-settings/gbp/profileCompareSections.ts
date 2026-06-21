import type { DualSyncSectionKey } from '@/server/dual-sync';

export const PROFILE_WORKSPACE_COMPARE_SECTION_KEYS = [
  'profile',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
] as const satisfies ReadonlyArray<DualSyncSectionKey>;
