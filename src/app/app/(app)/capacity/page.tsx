import { redirect } from 'next/navigation';

import { TableTimelineClient } from '@/components/features/tables/timeline';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Capacity Timeline | Operations',
  description: 'Track real-time table availability across lunch & dinner services.',
};

export default async function OpsCapacityPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/capacity] failed to resolve auth', error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom('/login', '/capacity'));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Capacity timeline</h1>
        <p className="text-sm text-muted-foreground">Visualise table status by service to keep the floor running smoothly.</p>
      </div>
      <TableTimelineClient />
    </div>
  );
}
