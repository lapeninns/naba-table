import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { getRestaurantSettingsMetadata } from '@/components/features/restaurant-settings/routes';

import type { Metadata } from 'next';

export const metadata: Metadata = getRestaurantSettingsMetadata(
  '/settings/restaurant/service-periods',
);

export default function ServicePeriodsSettingsPage() {
  return <OpsRestaurantSettingsClient view="availability" />;
}
