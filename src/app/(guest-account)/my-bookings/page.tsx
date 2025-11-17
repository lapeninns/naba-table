import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import { InfoCard } from '@/components/guest-account/InfoCard';
import { HeaderActions, PageShell } from '@/components/guest-account/PageShell';
import config from '@/config';
import { getOrCreateProfile } from '@/lib/profile/server';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import { MyBookingsClient } from './MyBookingsClient';
import { prefetchUpcomingBookings } from '../_lib/bookings-prefetch';
import { resolveDisplayName } from '../_lib/personalization';

import type { ProfileResponse } from '@/lib/profile/schema';

export const dynamic = 'force-dynamic';

export default async function MyBookingsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirectedFrom('/signin', '/my-bookings'));
  }

  let profile: ProfileResponse | null = null;
  try {
    profile = await getOrCreateProfile(supabase, user);
  } catch (error) {
    console.error('[my-bookings][profile] failed to resolve profile', error);
  }

  const displayName = resolveDisplayName(profile, user.email ?? null);
  const primaryEmail = profile?.email ?? user.email ?? null;

  const queryClient = new QueryClient();
  await prefetchUpcomingBookings(queryClient);
  const dehydratedState = dehydrate(queryClient);
  const supportEmail = config.email?.supportEmail ?? 'support@example.com';

  return (
    <PageShell
      eyebrow="Bookings"
      title="My bookings"
      description="Review and manage your reservations. Edit, cancel, or search your history in one place."
      actions={
        <HeaderActions
          primary={{ href: '/reserve', label: 'New booking' }}
          secondary={{ href: '/dashboard', label: 'Dashboard', variant: 'outline' }}
        />
      }
    >
      <div className="grid gap-6 xl:grid-cols-[3fr,1fr]">
        <div className="space-y-6">
          <HydrationBoundary state={dehydratedState}>
            <MyBookingsClient
              profileName={displayName}
              profileEmail={primaryEmail}
              supportEmail={supportEmail}
              showOverview={false}
            />
          </HydrationBoundary>
        </div>
        <div className="space-y-4">
          <InfoCard
            title="Need help with a booking?"
            description="We can assist with changes before the restaurant's cutoff window when available."
            footer={
              <div className="flex flex-col gap-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Contact support</span>
                <a
                  className="text-primary underline decoration-primary/60 underline-offset-4"
                  href={`mailto:${supportEmail}`}
                >
                  {supportEmail}
                </a>
              </div>
            }
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Include your booking reference and preferred adjustments.</li>
              <li>Share updates to party size or time as early as possible.</li>
              <li>We will reply from the address above—add it to your safe senders list.</li>
            </ul>
          </InfoCard>
        </div>
      </div>
    </PageShell>
  );
}
