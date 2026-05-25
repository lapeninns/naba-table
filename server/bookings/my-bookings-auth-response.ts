import { NextResponse } from 'next/server';

import {
  buildMyBookingsHttpResponse,
  type MyBookingsHttpClientFactory,
} from '@/server/bookings/my-bookings-response';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

export type MyBookingsAuthRouteClientFactory = typeof getRouteHandlerSupabaseClient;
export type MyBookingsAuthServiceClientFactory = typeof getServiceSupabaseClient;
export type MyBookingsAuthenticatedResponseBuilder = typeof buildMyBookingsHttpResponse;

export async function buildAuthenticatedMyBookingsHttpResponse({
  onPageFetchError,
  responseBuilder = buildMyBookingsHttpResponse,
  routeClientFor = getRouteHandlerSupabaseClient,
  searchParams,
  serviceClientFor = getServiceSupabaseClient,
}: {
  onPageFetchError?: (error: unknown) => void;
  responseBuilder?: MyBookingsAuthenticatedResponseBuilder;
  routeClientFor?: MyBookingsAuthRouteClientFactory;
  searchParams: URLSearchParams;
  serviceClientFor?: MyBookingsAuthServiceClientFactory;
}): Promise<NextResponse> {
  const supabase = await routeClientFor();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return await responseBuilder({
    clientFor: (() => serviceClientFor()) as unknown as MyBookingsHttpClientFactory,
    email: user.email,
    onPageFetchError,
    searchParams,
  });
}
