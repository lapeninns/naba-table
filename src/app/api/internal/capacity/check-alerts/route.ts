import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { checkCapacityAlerts } from '@/server/alerts/capacity';

const INTERNAL_HEADER = 'x-internal-api-key';

function authorize(request: NextRequest): NextResponse | null {
  const expectedKey = env.alerts.internalKey;
  if (!expectedKey) {
    return NextResponse.json({ error: 'Internal key not configured' }, { status: 501 });
  }

  const provided = request.headers.get(INTERNAL_HEADER);
  if (provided !== expectedKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authError = authorize(request);
  if (authError) {
    return authError;
  }

  const alerts = await checkCapacityAlerts();
  return NextResponse.json(alerts);
}
