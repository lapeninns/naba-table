import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant profile · Nab a Table Ops',
  description: 'Brand, contact details, team alerts, and public discovery.',
};

export default function RestaurantProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="profile" />;
}
