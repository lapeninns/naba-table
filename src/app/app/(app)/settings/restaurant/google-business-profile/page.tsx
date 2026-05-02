import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';

import type { Metadata } from 'next';

const route = RESTAURANT_SETTINGS_ROUTE_MAP['google-business-profile'];

export const metadata: Metadata = {
  title: `${route.title} · Nab a Table Ops`,
  description: route.description,
};

export default function GoogleBusinessProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="google-business-profile" />;
}
