import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tables · Nab a Table Ops',
  description:
    'Configure seating resources, capacity assumptions, and service zones for your restaurant.',
};

export default function RestaurantTablesSettingsPage() {
  return <OpsRestaurantSettingsClient view="tables" />;
}
