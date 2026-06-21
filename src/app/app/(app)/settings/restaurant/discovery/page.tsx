import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discovery details · Nab a Table Ops',
  description: 'Categories, links, and attributes that help guests find your restaurant.',
};

export default function RestaurantDiscoverySettingsPage() {
  return <OpsRestaurantSettingsClient view="discovery" />;
}
