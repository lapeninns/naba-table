import dynamic from 'next/dynamic';
import { notFound, redirect } from 'next/navigation';

import { env } from '@/lib/env';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rejection analytics · Nab a Table Ops',
  description: 'Investigate why bookings are skipped and adjust strategic weights to optimise seating outcomes.',
};

const OpsRejectionDashboard = dynamic(
  () => import('@/components/features/dashboard/rejections').then((m) => m.OpsRejectionDashboard),
  {
    loading: () => (
      <div className="mx-auto max-w-[80vw] space-y-4 px-4 py-6 sm:px-6 lg:px-8" role="status" aria-busy>
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
          <div className="h-4 w-1/2 rounded bg-muted-foreground/20" />
          <div className="h-4 w-2/3 rounded bg-muted-foreground/20" />
          <div className="h-32 rounded bg-muted-foreground/10" />
        </div>
      </div>
    ),
  },
);

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
    redirect(withRedirectedFrom('/login', '/rejections'));
  }

  return (
    <div className="mx-auto flex max-w-[80vw] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <OpsRejectionDashboard />
    </div>
  );
}
