import { NextResponse } from 'next/server';

import { reconcileReviewMessageCosts } from '@/server/reviews/cost-reconciler';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return requireCronAuthAndRun(request, 'reconcile-review-costs', async (auth) => {
    try {
      const summary = await reconcileReviewMessageCosts();
      return NextResponse.json({ success: true, runId: auth.runId, ...summary });
    } catch {
      return NextResponse.json({ error: 'Review cost reconciliation failed.' }, { status: 500 });
    }
  });
}
