import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Periods · Nab a Table Ops',
  description: 'Define booking windows for lunch and dinner inside operating hours.',
};

export default function ServicePeriodsSettingsPage() {
  return <OpsRestaurantSettingsClient view="availability" availabilityWorkspace="schedule" />;
}
