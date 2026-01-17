import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Booking Occasions · Nab a Table Ops',
  description: 'Control which occasions are available to staff and guests.',
};

export default function BookingOccasionsSettingsPage() {
  return <OpsRestaurantSettingsClient view="occasions" />;
}
