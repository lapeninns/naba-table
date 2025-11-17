import { QueryClient } from '@tanstack/react-query';
import { cookies, headers } from 'next/headers';

import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { queryKeys } from '@/lib/query/keys';
import { getCanonicalSiteUrl } from '@/lib/site-url';

import type { BookingsPage } from '@/hooks/useBookings';

export function buildDefaultSearchParams(pageSize: number = DASHBOARD_DEFAULT_PAGE_SIZE): URLSearchParams {
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

export function resolveOrigin(requestHeaders: HeaderLike): string {
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

export async function prefetchUpcomingBookings(queryClient: QueryClient) {
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
    console.error('[guest-account][bookings][prefetch]', error);
  }
}
