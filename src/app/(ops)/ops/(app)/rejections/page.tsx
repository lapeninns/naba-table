import { notFound, redirect } from 'next/navigation';

import { OpsRejectionDashboard } from '@/components/features/dashboard/rejections';
import { env } from '@/lib/env';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rejection analytics · SajiloReserveX Ops',
  description: 'Investigate why bookings are skipped and adjust strategic weights to optimise seating outcomes.',
};

export default async function OpsRejectionsPage() {
  if (!env.featureFlags.opsRejectionAnalytics) {
    notFound();
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/rejections] failed to resolve auth', error.message);
  }

  if (!user) {
    redirect('/signin?redirectedFrom=/ops/rejections');
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-6">
      <OpsRejectionDashboard />
    </div>
  );
}
