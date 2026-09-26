import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { getRestaurantSettingsMetadata } from '@/components/features/restaurant-settings/routes';

import type { Metadata } from 'next';

export const metadata: Metadata = getRestaurantSettingsMetadata(
  '/settings/restaurant/google-business-profile',
);

export default function GoogleBusinessProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="google-business-profile" />;
}
