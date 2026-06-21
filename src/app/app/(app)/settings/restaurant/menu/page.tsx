import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menu · Nab a Table Ops',
  description: 'Manage menus, sections, items, options, and Google-compatible publishing fields.',
};

export default function RestaurantMenuSettingsPage() {
  return <OpsRestaurantSettingsClient view="menu" />;
}
