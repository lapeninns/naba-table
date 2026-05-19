import type { DualSyncSectionKey } from '@/server/dual-sync';

export const GBP_DRIFT_SECTION_ORDER: ReadonlyArray<DualSyncSectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
];

export const GBP_DRIFT_SECTION_LABELS: Record<DualSyncSectionKey, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
  foodMenus: 'Food menus',
};
