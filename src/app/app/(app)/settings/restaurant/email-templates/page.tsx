import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Templates · Nab a Table Ops',
  description: 'Customize booking confirmation, reminder, cancellation, and review email copy.',
};

export default function RestaurantEmailTemplatesSettingsPage() {
  return <OpsRestaurantSettingsClient view="email-templates" />;
}
