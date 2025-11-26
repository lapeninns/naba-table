import { redirect } from 'next/navigation';

import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import config from '@/config';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { ReactNode } from 'react';

export default async function RestaurantSettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[settings/restaurant] failed to resolve auth', error.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? '/login';
    redirect(withRedirectedFrom(loginUrl, '/settings/restaurant/profile'));
  }

  return (
    <RestaurantSettingsPageShell
      title="Restaurant"
      description="Configure the restaurant profile, operating hours, service periods, booking occasions, and tables."
    >
      {children}
    </RestaurantSettingsPageShell>
  );
}
