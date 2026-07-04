import { NextResponse } from 'next/server';

import { captureServerException } from '@/lib/posthog/server';
import { sendMonthlyVenueReports } from '@/server/jobs/monthly-venue-report';
import { isFirstWednesdayOfMonth } from '@/server/reports/monthly-venue-report';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'monthly-venue-report';

export async function GET(request: Request) {
  await flushPosthogLogsAfterResponse();

  return requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    const url = new URL(request.url);
    const dryRun = ['1', 'true', 'yes'].includes(
      (url.searchParams.get('dryRun') ?? '').toLowerCase(),
    );
    const force = ['1', 'true', 'yes'].includes(
      (url.searchParams.get('force') ?? '').toLowerCase(),
    );
    const restaurantIdFilter = url.searchParams.get('restaurantId') ?? undefined;

    try {
      // Guard: only run on the first Wednesday of the month, unless forced
      if (!force && !isFirstWednesdayOfMonth()) {
        console.info(
          '[cron][monthly-venue-report] skipped: not the first Wednesday of the month',
          { runId: auth.runId },
        );
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'not_first_wednesday',
          runId: auth.runId,
        });
      }

      const summary = await sendMonthlyVenueReports({
        dryRun,
        restaurantIdFilter,
      });

      return NextResponse.json({
        success: true,
        runId: auth.runId,
        ...summary,
      });
    } catch (error) {
      console.error('[cron][monthly-venue-report] failed', {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
      });
      captureServerException(error, {
        properties: {
          jobName: auth.jobName,
          runId: auth.runId,
          source: 'cron',
        },
      });
      return NextResponse.json(
        { error: 'Monthly venue report cron failed.' },
        { status: 500 },
      );
    }
  });
}
