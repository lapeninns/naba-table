import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Availability & Occasions · Nab a Table Ops',
  description: 'Manage weekly hours, date overrides, service periods, and booking occasions.',
};

export default function AvailabilitySettingsPage() {
  return <OpsRestaurantSettingsClient view="availability" />;
}
