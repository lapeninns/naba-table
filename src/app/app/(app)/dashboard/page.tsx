import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies, headers } from 'next/headers';

import { BookingErrorBoundary } from '@/components/features/booking-state-machine';
import { OpsDashboardClient } from '@/components/features/dashboard/OpsDashboardClient';
import { BookingOfflineQueueProvider } from '@/contexts/booking-offline-queue';
import { queryKeys } from '@/lib/query/keys';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';
import { sanitizeDateParam } from '@/utils/ops/dashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Ops Dashboard · Nab a Table",
    description: "Monitor today's bookings and keep your front of house running smoothly.",
};

export const dynamic = 'force-dynamic';

type OpsPageSearchParams = {
    date?: string;
};

const cookieHeaderFromStore = (cookieStore: Awaited<ReturnType<typeof cookies>>): string => {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
};

const resolveOrigin = (requestHeaders: Headers): string => {
  const forwardedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  if (forwardedHost) {
    return `${forwardedProto ?? 'https'}://${forwardedHost}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? getCanonicalSiteUrl();
};

async function prefetchOpsSummary(
  queryClient: QueryClient,
  restaurantId: string,
  date: string | null,
) {
  try {
    const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
    const cookieHeader = cookieHeaderFromStore(cookieStore);
    const origin = resolveOrigin(requestHeaders);
    const url = new URL(`${origin}/api/ops/dashboard/summary`);

    url.searchParams.set('restaurantId', restaurantId);
    if (date) {
      url.searchParams.set('date', date);
    }

    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return;
    }

    const summary = (await response.json()) as unknown;
    queryClient.setQueryData(queryKeys.opsDashboard.summary(restaurantId, date), summary);
  } catch (error) {
    console.error('[ops/dashboard][prefetch] failed to load summary', error);
  }
}

export default async function OpsDashboardPage({ searchParams }: { searchParams?: Promise<OpsPageSearchParams> }) {
    const resolvedParams = (await searchParams) ?? {};
    // Auth is now handled by the layout - no need for duplicate check
    const initialDate = sanitizeDateParam(resolvedParams.date);
    const queryClient = new QueryClient();

    try {
      const supabase = await getServerComponentSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const memberships = await fetchUserMemberships(user.id);
        const restaurantId = memberships.find((membership) => Boolean(membership.restaurant_id))?.restaurant_id ?? null;
        if (restaurantId) {
          await prefetchOpsSummary(queryClient, restaurantId, initialDate);
        }
      }
    } catch (error) {
      console.error('[ops/dashboard][prefetch] failed to resolve memberships', error);
    }
    const dehydratedState = dehydrate(queryClient);

    return (
        <BookingErrorBoundary>
            <BookingOfflineQueueProvider>
                <HydrationBoundary state={dehydratedState}>
                    <OpsDashboardClient initialDate={initialDate} />
                </HydrationBoundary>
            </BookingOfflineQueueProvider>
        </BookingErrorBoundary>
    );
}
