import { redirect } from 'next/navigation';

import { OpsRestaurantSettingsClient } from '@/components/features';
import config from '@/config';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restaurant Settings · SajiloReserveX Ops',
  description: 'Configure restaurant profile, operating hours, and service periods',
};

export default async function OpsSettingsRestaurantPage() {
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
    redirect(withRedirectedFrom(loginUrl, '/settings/restaurant'));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <OpsRestaurantSettingsClient />
    </div>
  );
}
