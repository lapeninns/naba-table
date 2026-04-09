import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Google Business Profile · Nab a Table Ops',
  description: 'Connect, sync, and review Google Business Profile data for the active restaurant.',
};

export default function RestaurantGoogleBusinessProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="google-business-profile" />;
}
