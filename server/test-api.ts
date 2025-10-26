import { NextResponse } from 'next/server';

import { env } from '@/lib/env';

import type { NextRequest} from 'next/server';

const TEST_ROUTE_HEADER = 'x-test-route-key';
const ENABLE_TEST_API = env.featureFlags.enableTestApi || env.node.env !== 'production';

export function guardTestRoute(req: NextRequest): NextResponse | null {
  if (!ENABLE_TEST_API) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const expectedKey = env.raw.TEST_ROUTE_API_KEY;
  if (expectedKey) {
    const provided = req.headers.get(TEST_ROUTE_HEADER);
    if (provided !== expectedKey) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return null;
}

export function testRouteHeaders(): Record<string, string> {
  const expectedKey = env.raw.TEST_ROUTE_API_KEY;
  return expectedKey ? { [TEST_ROUTE_HEADER]: expectedKey } : {};
}
