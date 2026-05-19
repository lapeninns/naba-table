import { RestaurantSetupOverview } from '@/components/features/restaurant-settings/RestaurantSetupOverview';
import { RESTAURANT_SETTINGS_OVERVIEW_ROUTE } from '@/components/features/restaurant-settings/routes';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `${RESTAURANT_SETTINGS_OVERVIEW_ROUTE.title} · Nab a Table Ops`,
  description: RESTAURANT_SETTINGS_OVERVIEW_ROUTE.description,
};

export default function RestaurantSettingsIndexPage() {
  return <RestaurantSetupOverview />;
}
