import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant Settings · Nab a Table Ops',
  description: 'Configure restaurant profile, availability, reservation durations, and occasions',
};

export default function OpsSettingsRestaurantPage() {
  redirect(opsHref('/settings/restaurant/availability'));
}
