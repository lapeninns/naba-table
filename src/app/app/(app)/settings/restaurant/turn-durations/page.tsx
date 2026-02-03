import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservation Durations · Nab a Table Ops',
  description: 'Configure dining duration bands by party size.',
};

export default function TurnDurationsSettingsPage() {
  return <OpsRestaurantSettingsClient view="turn-durations" />;
}
