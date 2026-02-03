import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant Settings · Nab a Table Ops',
  description: 'Configure restaurant profile, operating hours, service periods, reservation durations, and occasions',
};

export default function OpsSettingsRestaurantPage() {
  redirect('/settings/restaurant/profile');
}
