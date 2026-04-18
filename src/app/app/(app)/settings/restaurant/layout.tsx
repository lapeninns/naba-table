import { redirect } from 'next/navigation';

import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
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
    redirect(withRedirectedFrom('/app/auth/signin', '/app/settings/restaurant/profile'));
  }

  return (
    <RestaurantSettingsPageShell
      title="Restaurant"
      description="Configure the restaurant profile, availability, reservation durations, menu, tables, and team access."
    >
      {children}
    </RestaurantSettingsPageShell>
  );
}
