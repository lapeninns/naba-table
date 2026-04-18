import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Google Business Profile · Nab a Table Ops',
  description: 'Connect a Google account and link the correct GBP location to this restaurant.',
};

export default function GoogleBusinessProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="google-business-profile" />;
}
