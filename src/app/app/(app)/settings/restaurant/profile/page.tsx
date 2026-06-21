import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant profile · Nab a Table Ops',
  description: 'Brand, contact details, booking page URL, and team alerts.',
};

export default function RestaurantProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="profile" />;
}
