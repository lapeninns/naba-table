import { OpsRestaurantSettingsClient } from '@/components/features';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team · Nab a Table Ops',
  description: 'Manage restaurant team invitations and access.',
};

export default function RestaurantTeamSettingsPage() {
  return <OpsRestaurantSettingsClient view="team" />;
}
