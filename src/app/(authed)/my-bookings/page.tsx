import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import type { BookingsPage } from '@/hooks/useBookings';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/query/keys';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import { MyBookingsClient } from './MyBookingsClient';

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

  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

async function prefetchUpcomingBookings(queryClient: QueryClient) {
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
    redirect('/signin?redirectedFrom=/my-bookings');
  }

  const queryClient = new QueryClient();
  await prefetchUpcomingBookings(queryClient);
  const dehydratedState = dehydrate(queryClient);
  const scheduleParityEnabled = env.featureFlags.editScheduleParity ?? false;

  return (
    <HydrationBoundary state={dehydratedState}>
      <MyBookingsClient scheduleParityEnabled={scheduleParityEnabled} />
    </HydrationBoundary>
  );
}
