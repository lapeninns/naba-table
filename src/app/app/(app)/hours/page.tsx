import Link from 'next/link';
import { redirect } from 'next/navigation';

import { OpsRestaurantSettingsClient } from '@/components/features';
import config from '@/config';
import { Button } from '@/components/ui/button';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Periods · SajiloReserveX Ops',
  description: 'Manage service periods for your restaurant.',
};

export default async function OpsSettingsServicePeriodsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[app/hours] failed to resolve auth', error.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? '/login';
    redirect(withRedirectedFrom(loginUrl, '/hours'));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Service periods</h1>
        <Button asChild variant="outline" className="touch-manipulation">
          <Link href="/ops">← Back to dashboard</Link>
        </Button>
      </div>
      <OpsRestaurantSettingsClient />
    </div>
  );
}
