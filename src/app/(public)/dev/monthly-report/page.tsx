import { renderMonthlyReportEmail } from '@/server/emails/monthly-report';
import { computeMonthlyVenueReport } from '@/server/reports/monthly-venue-report';
import { getServiceSupabaseClient } from '@/server/supabase';

import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dev: Monthly report',
};

const DEFAULT_VENUE_SLUG = 'the-old-crown-girton';
const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 7;

type MonthlyReportDevPageProps = {
  searchParams: Promise<{
    venue?: string;
    year?: string;
    month?: string;
  }>;
};

function integerInRange(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export default async function MonthlyReportDevPage({ searchParams }: MonthlyReportDevPageProps) {
  enforceDevOnly();

  const params = await searchParams;
  const venueSlug = params.venue?.trim() || DEFAULT_VENUE_SLUG;
  const year = integerInRange(params.year, DEFAULT_YEAR, 2000, 2100);
  const month = integerInRange(params.month, DEFAULT_MONTH, 1, 12);
  const client = getServiceSupabaseClient();
  const { data: venue, error: venueError } = await client
    .from('restaurants')
    .select('id')
    .eq('slug', venueSlug)
    .maybeSingle();

  if (venueError) throw venueError;

  if (!venue) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Monthly report dev harness</h1>
          <p className="mt-3 text-sm text-red-700">No venue found for slug “{venueSlug}”.</p>
        </div>
      </main>
    );
  }

  const report = await computeMonthlyVenueReport(venue.id, { year, month });

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Monthly report dev harness</h1>
          <p className="mt-3 text-sm text-amber-800">
            No reportable booking activity was found for {venueSlug} in {year}-
            {String(month).padStart(2, '0')}.
          </p>
        </div>
      </main>
    );
  }

  const preview = renderMonthlyReportEmail({
    report,
    dashboardUrl: 'http://localhost:3000/app/dashboard',
  });
  const frameTitle = `${report.restaurantName} monthly report for ${report.month}`;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Local preview · production renderer
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Monthly report dev harness</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {report.restaurantName} · {report.month}
          </p>
          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subject
            </span>
            <p className="mt-1 text-sm text-slate-800">{preview.subject}</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <iframe
            className="h-[1700px] w-full bg-white"
            srcDoc={preview.html}
            title={frameTitle}
            sandbox=""
          />
        </section>

        <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Plain-text alternative
          </summary>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-600">
            {preview.text}
          </pre>
        </details>
      </div>
    </main>
  );
}
