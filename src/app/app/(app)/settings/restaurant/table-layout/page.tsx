import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { getRestaurantSettingsMetadata } from '@/components/features/restaurant-settings/routes';

import type { Metadata } from 'next';

export const metadata: Metadata = getRestaurantSettingsMetadata(
  '/settings/restaurant/table-layout',
);

export default function RestaurantTableLayoutSettingsPage() {
  return <OpsRestaurantSettingsClient view="table-layout" />;
}
