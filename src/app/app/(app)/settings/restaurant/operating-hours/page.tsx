import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operating Hours · Nab a Table Ops',
  description: 'Configure weekly open/close times and special overrides.',
};

export default function OperatingHoursSettingsPage() {
  return <OpsRestaurantSettingsClient view="availability" />;
}
