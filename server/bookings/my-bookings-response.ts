import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api/errors';
import { buildMyBookingsPageResponse } from '@/server/bookings/my-bookings-dto';
import {
  fetchMyBookingsPage,
  type MyBookingsPageQueryClient,
} from '@/server/bookings/my-bookings-page';
import { parseMyBookingsQuery } from '@/server/bookings/my-bookings-query';
import { mapBookingZodValidationFailure } from '@/server/bookings/zod-validation-error';

export type MyBookingsHttpResponseClient = MyBookingsPageQueryClient;
export type MyBookingsHttpClientFactory = () => MyBookingsHttpResponseClient;
export type MyBookingsHttpQueryParser = typeof parseMyBookingsQuery;
export type MyBookingsHttpPageFetcher = typeof fetchMyBookingsPage;
export type MyBookingsHttpResponseBuilder = typeof buildMyBookingsPageResponse;

export async function buildMyBookingsHttpResponse({
  client,
  clientFor,
  userId,
  email,
  emailMatch = false,
  onPageFetchError,
  pageFetcher = fetchMyBookingsPage,
  responseBuilder = buildMyBookingsPageResponse,
  searchParams,
  queryParser = parseMyBookingsQuery,
}: {
  client?: MyBookingsHttpResponseClient;
  clientFor?: MyBookingsHttpClientFactory;
  /** Session user id: bookings bound to it are always listed. */
  userId: string;
  email?: string | null;
  /** Also list rows whose email matches (SESSION_EMAIL_MATCH_ENABLED + confirmed email). */
  emailMatch?: boolean;
  onPageFetchError?: (error: unknown) => void;
  pageFetcher?: MyBookingsHttpPageFetcher;
  responseBuilder?: MyBookingsHttpResponseBuilder;
  searchParams: URLSearchParams;
  queryParser?: MyBookingsHttpQueryParser;
}): Promise<NextResponse> {
  const parsed = queryParser(searchParams);

  if (!parsed.ok) {
    if (parsed.kind === 'date_range') {
      return apiError(400, 'INVALID_DATE_RANGE', 'Invalid date range.');
    }

    const validationFailure = mapBookingZodValidationFailure(parsed.error);
    return NextResponse.json(validationFailure.body, { status: validationFailure.status });
  }

  const params = parsed.query;
  const queryClient = client ?? clientFor?.();
  if (!queryClient) {
    throw new Error('My bookings response requires a query client.');
  }

  const pageResult = await pageFetcher({
    client: queryClient,
    userId,
    email: email ? email.toLowerCase() : null,
    emailMatch,
    query: params,
  });

  if (!pageResult.ok) {
    onPageFetchError?.(pageResult.error);
    return apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Try again.');
  }

  const response = responseBuilder({
    rows: pageResult.rows,
    page: params.page,
    pageSize: params.pageSize,
    total: pageResult.total,
  });

  return NextResponse.json(response);
}
