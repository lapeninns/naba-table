import { type NextRequest, NextResponse } from 'next/server';

import { renderMonthlyReportEmail } from '@/server/emails/monthly-report';
import { computeMonthlyVenueReport } from '@/server/reports/monthly-venue-report';
import { getServiceSupabaseClient } from '@/server/supabase';

import { enforceDevOnly } from '../../_shared/enforceDevOnly';

const DEFAULT_VENUE_SLUG = 'the-old-crown-girton';
const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 7;

function integerInRange(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  enforceDevOnly();

  const venueSlug = request.nextUrl.searchParams.get('venue')?.trim() || DEFAULT_VENUE_SLUG;
  const year = integerInRange(request.nextUrl.searchParams.get('year'), DEFAULT_YEAR, 2000, 2100);
  const month = integerInRange(request.nextUrl.searchParams.get('month'), DEFAULT_MONTH, 1, 12);
  const client = getServiceSupabaseClient();
  const { data: venue, error: venueError } = await client
    .from('restaurants')
    .select('id')
    .eq('slug', venueSlug)
    .maybeSingle();

  if (venueError) throw venueError;
  if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });

  const report = await computeMonthlyVenueReport(venue.id, { year, month });
  if (!report) {
    return NextResponse.json({ error: 'No reportable activity found' }, { status: 404 });
  }

  const preview = renderMonthlyReportEmail({
    report,
    dashboardUrl: 'http://localhost:3000/app/dashboard',
  });

  return new NextResponse(preview.html, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
