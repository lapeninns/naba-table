import { opsHref } from '@/lib/url/opsHref';

import type { DualSyncSectionKey } from '@/server/dual-sync';

export const GBP_DRIFT_SECTION_ROUTES: Record<DualSyncSectionKey, string> = {
  profile: opsHref('/settings/restaurant/profile#profile-identity'),
  operatingHours: opsHref('/settings/restaurant/availability#availability-hours'),
  servicePeriods: opsHref('/settings/restaurant/availability#service-periods'),
  'businessContext.categories': opsHref('/settings/restaurant/profile#profile-discovery'),
  'businessContext.serviceAreas': opsHref('/settings/restaurant/profile#profile-discovery'),
  'businessContext.attributes': opsHref('/settings/restaurant/profile#profile-discovery'),
  'businessContext.serviceItems': opsHref('/settings/restaurant/profile#profile-discovery'),
  foodMenus: opsHref('/settings/restaurant/menu'),
};
