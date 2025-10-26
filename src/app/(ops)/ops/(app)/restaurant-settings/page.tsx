import { redirect } from 'next/navigation';

import { OpsRestaurantSettingsClient } from '@/components/features';
import config from '@/config';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant Settings · SajiloReserveX Ops',
  description: 'Configure operating hours and service periods for your restaurant',
};

export default async function RestaurantSettingsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/restaurant-settings] failed to resolve auth', error.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? '/signin';
    redirect(`${loginUrl}?redirectedFrom=/ops/restaurant-settings`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-6">
      <OpsRestaurantSettingsClient />
    </div>
  );
}
