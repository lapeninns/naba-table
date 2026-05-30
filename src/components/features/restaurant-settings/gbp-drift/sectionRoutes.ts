import { opsHref } from '@/lib/url/opsHref';

import { AVAILABILITY_ANCHORS, availabilityHash } from '../availabilityAnchors';

import type { DualSyncSectionKey } from '@/server/dual-sync';

export const GBP_DRIFT_SECTION_ROUTES: Record<DualSyncSectionKey, string> = {
  profile: opsHref('/settings/restaurant/profile#profile-identity'),
  operatingHours: opsHref(
    `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.weeklyHours)}`,
  ),
  servicePeriods: opsHref(
    `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.serviceWindows)}`,
  ),
  'businessContext.categories': opsHref(
    '/settings/restaurant/discovery#profile-discovery-categories',
  ),
  'businessContext.serviceAreas': opsHref(
    '/settings/restaurant/discovery#profile-discovery-serviceAreas',
  ),
  'businessContext.attributes': opsHref(
    '/settings/restaurant/discovery#profile-discovery-attributes',
  ),
  'businessContext.serviceItems': opsHref(
    '/settings/restaurant/discovery#profile-discovery-serviceItems',
  ),
  foodMenus: opsHref('/settings/restaurant/menu'),
};
