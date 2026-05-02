import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Availability & Occasions · Nab a Table Ops',
  description:
    'Booking rules, weekly hours, overrides, meal windows, occasions, and dining-duration bands.',
};

export default function AvailabilitySettingsPage() {
  return <OpsRestaurantSettingsClient view="availability" />;
}
