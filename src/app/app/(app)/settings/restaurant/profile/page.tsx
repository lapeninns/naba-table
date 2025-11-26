import { OpsRestaurantSettingsClient } from '@/components/features';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant Profile · Nab a Table Ops',
  description: 'Manage restaurant details, branding, and booking policy.',
};

export default function RestaurantProfileSettingsPage() {
  return <OpsRestaurantSettingsClient view="profile" />;
}
