import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { InfoCard } from '@/components/guest-account/InfoCard';
import { HeaderActions, PageShell } from '@/components/guest-account/PageShell';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import config from '@/config';
import { queryKeys } from '@/lib/query/keys';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import { MyBookingsClient } from './MyBookingsClient';

import type { BookingsPage } from '@/hooks/useBookings';

export const dynamic = 'force-dynamic';

function buildDefaultSearchParams(pageSize: number): URLSearchParams {
  const params = new URLSearchParams({
    me: '1',
    page: '1',
    pageSize: String(pageSize),
    sort: 'asc',
  });

  params.set('from', new Date().toISOString());
  return params;
}

type HeaderLike = {
  get(name: string): string | null | undefined;
};

function resolveOrigin(requestHeaders: HeaderLike): string {
  const forwardedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  const origin = requestHeaders.get('origin');

  if (origin) {
    return origin;
  }

  if (forwardedHost) {
    const protocol = forwardedProto ?? 'https';
    return `${protocol}://${forwardedHost}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? getCanonicalSiteUrl();
}

const SKIP_PREFETCH_FOR_PLAYWRIGHT = process.env.PLAYWRIGHT_TEST_DASHBOARD === 'true';

async function prefetchUpcomingBookings(queryClient: QueryClient) {
  if (SKIP_PREFETCH_FOR_PLAYWRIGHT) {
    return;
  }
  const searchParams = buildDefaultSearchParams(DASHBOARD_DEFAULT_PAGE_SIZE);
  const keyParams = Object.fromEntries(searchParams.entries());
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  const origin = resolveOrigin(requestHeaders);
  const url = `${origin}/api/bookings?${searchParams.toString()}`;

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.bookings.list(keyParams),
      queryFn: async () => {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to prefetch bookings (${response.status})`);
        }

        return (await response.json()) as BookingsPage;
      },
    });
  } catch (error) {
    console.error('[my-bookings][prefetch]', error);
  }
}

export default async function MyBookingsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirectedFrom('/signin', '/my-bookings'));
  }

  const queryClient = new QueryClient();
  await prefetchUpcomingBookings(queryClient);
  const dehydratedState = dehydrate(queryClient);
  const supportEmail = config.email?.supportEmail ?? 'support@example.com';

  return (
    <PageShell
      eyebrow="Your account"
      title="My bookings"
      description="See upcoming reservations at a glance, manage changes, and keep your details up to date."
      actions={
        <HeaderActions
          primary={{ href: '/reserve', label: 'New booking' }}
          secondary={{ href: '/profile/manage', label: 'Manage profile', variant: 'outline' }}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <HydrationBoundary state={dehydratedState}>
            <MyBookingsClient />
          </HydrationBoundary>
        </div>
        <div className="space-y-4">
          <InfoCard
            title="Need to change plans?"
            description="Most bookings can be changed or canceled ahead of the restaurant’s cutoff window."
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
              <li>Check your confirmation for the latest cutoff times.</li>
              <li>Tell us about changes to party size or time as early as possible.</li>
              <li>Keep your contact details current so updates reach you quickly.</li>
            </ul>
          </InfoCard>
          <InfoCard
            title="Tips for faster check-in"
            description="Save time by keeping your profile complete."
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the same email you share with the restaurant team.</li>
              <li>Add a phone number so staff can reach you on the day.</li>
              <li>Have your booking reference ready when you arrive.</li>
            </ul>
          </InfoCard>
        </div>
      </div>
    </PageShell>
  );
}
