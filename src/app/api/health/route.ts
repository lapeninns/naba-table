import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';

const healthLogger = logger.child({ module: 'api.health' });

export async function GET() {
  let database: 'connected' | 'unreachable' | 'unknown' = 'unknown';

  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase.from('restaurants').select('id').limit(1);
    database = error ? 'unreachable' : 'connected';
    if (error) {
      healthLogger.warn('health check database probe failed', { error: error.message });
    }
  } catch (error) {
    database = 'unreachable';
    healthLogger.error('health check encountered an exception', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown';
  const status = database === 'connected' ? 'healthy' : 'degraded';
  const statusCode = database === 'connected' ? 200 : 503;

  return NextResponse.json({ status, database, version }, { status: statusCode });
}
