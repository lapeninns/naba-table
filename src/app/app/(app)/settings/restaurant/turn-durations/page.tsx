import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { getRestaurantSettingsMetadata } from '@/components/features/restaurant-settings/routes';

import type { Metadata } from 'next';

export const metadata: Metadata = getRestaurantSettingsMetadata(
  '/settings/restaurant/turn-durations',
);

export default function TurnDurationsSettingsPage() {
  return <OpsRestaurantSettingsClient view="availability" />;
}
