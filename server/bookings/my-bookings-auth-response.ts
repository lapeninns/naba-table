
import { unauthenticated } from '@/lib/api/errors';
import { SESSION_EMAIL_MATCH_ENABLED } from '@/server/bookings/guest-booking-access';
import {
  buildMyBookingsHttpResponse,
  type MyBookingsHttpClientFactory,
} from '@/server/bookings/my-bookings-response';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextResponse } from 'next/server';

export type MyBookingsAuthRouteClientFactory = typeof getRouteHandlerSupabaseClient;
export type MyBookingsAuthServiceClientFactory = typeof getServiceSupabaseClient;
export type MyBookingsAuthenticatedResponseBuilder = typeof buildMyBookingsHttpResponse;

export async function buildAuthenticatedMyBookingsHttpResponse({
  emailMatchEnabled = SESSION_EMAIL_MATCH_ENABLED,
  onPageFetchError,
  responseBuilder = buildMyBookingsHttpResponse,
  routeClientFor = getRouteHandlerSupabaseClient,
  searchParams,
  serviceClientFor = getServiceSupabaseClient,
}: {
  /** Test seam; production uses SESSION_EMAIL_MATCH_ENABLED. */
  emailMatchEnabled?: boolean;
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

  if (authError || !user) {
    return unauthenticated();
  }

  const emailMatch = emailMatchEnabled && Boolean(user.email) && Boolean(user.email_confirmed_at);

  return await responseBuilder({
    clientFor: (() => serviceClientFor()) as unknown as MyBookingsHttpClientFactory,
    userId: user.id,
    email: emailMatch ? (user.email ?? null) : null,
    emailMatch,
    onPageFetchError,
    searchParams,
  });
}
