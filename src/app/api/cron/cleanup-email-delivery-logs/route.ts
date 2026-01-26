import { NextResponse } from 'next/server';

import { cleanupEmailDeliveryLogs } from '@/server/emails/delivery-log';

const CRON_SECRET = process.env.CRON_SECRET;
const RETENTION_DAYS = 180;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (CRON_SECRET && !hasValidBearerToken) {
    console.warn('[cron][cleanup-email-delivery-logs] Unauthorized request', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!CRON_SECRET,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!CRON_SECRET) {
    console.warn('[cron][cleanup-email-delivery-logs] CRON_SECRET not set - endpoint is unprotected');
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const deleted = await cleanupEmailDeliveryLogs({ cutoffIso: cutoff });
    return NextResponse.json({ success: true, deleted, cutoff, retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error('[cron][cleanup-email-delivery-logs] failed to run', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
