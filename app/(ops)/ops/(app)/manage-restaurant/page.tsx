import type { Metadata } from 'next';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';

import { RestaurantsClient } from '@/components/ops/restaurants/RestaurantsClient';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { queryKeys } from '@/lib/query/keys';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import config from '@/config';

export const metadata: Metadata = {
  title: 'Manage Restaurants · SajiloReserveX Ops',
  description: 'Create, update, and manage your restaurants in the system.',
};

function buildDefaultSearchParams(pageSize: number): URLSearchParams {
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
    sort: 'name',
  });
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

async function prefetchRestaurants(queryClient: QueryClient, params: URLSearchParams) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  const origin = resolveOrigin(requestHeaders);
  const url = `${origin}/api/ops/restaurants?${params.toString()}`;
  const keyParams = Object.fromEntries(params.entries());

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.opsRestaurants.list(keyParams),
      queryFn: async () => {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to prefetch restaurants (${response.status})`);
        }

        return await response.json();
      },
    });
  } catch (error) {
    console.error('[ops/manage-restaurant] prefetch failed', error);
  }
}

export default async function ManageRestaurantPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/manage-restaurant] failed to resolve auth', error.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? '/signin';
    redirect(`${loginUrl}?redirectedFrom=/ops/manage-restaurant`);
  }

  const queryClient = new QueryClient();
  const params = buildDefaultSearchParams(DASHBOARD_DEFAULT_PAGE_SIZE);
  await prefetchRestaurants(queryClient, params);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <RestaurantsClient />
    </HydrationBoundary>
  );
}
