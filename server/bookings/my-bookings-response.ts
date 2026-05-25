import { NextResponse } from 'next/server';

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
  email,
  onPageFetchError,
  pageFetcher = fetchMyBookingsPage,
  responseBuilder = buildMyBookingsPageResponse,
  searchParams,
  queryParser = parseMyBookingsQuery,
}: {
  client?: MyBookingsHttpResponseClient;
  clientFor?: MyBookingsHttpClientFactory;
  email: string;
  onPageFetchError?: (error: unknown) => void;
  pageFetcher?: MyBookingsHttpPageFetcher;
  responseBuilder?: MyBookingsHttpResponseBuilder;
  searchParams: URLSearchParams;
  queryParser?: MyBookingsHttpQueryParser;
}): Promise<NextResponse> {
  const parsed = queryParser(searchParams);

  if (!parsed.ok) {
    if (parsed.kind === 'date_range') {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
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
    email: email.toLowerCase(),
    query: params,
  });

  if (!pageResult.ok) {
    onPageFetchError?.(pageResult.error);
    return NextResponse.json({ error: 'Unable to fetch bookings' }, { status: 500 });
  }

  const response = responseBuilder({
    rows: pageResult.rows,
    page: params.page,
    pageSize: params.pageSize,
    total: pageResult.total,
  });

  return NextResponse.json(response);
}
