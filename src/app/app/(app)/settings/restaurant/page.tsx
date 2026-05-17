import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant profile · Nab a Table Ops',
  description: 'Public details, booking page URL, manager alerts, and optional discovery.',
};

export default function RestaurantSettingsIndexPage() {
  redirect('/app/settings/restaurant/profile');
}
