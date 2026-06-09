import { NextResponse } from 'next/server';

import { captureServerException } from '@/lib/posthog/server';

import { ensureRestaurantAdminAccess } from '../_shared';

import type { NextRequest } from 'next/server';

type RouteParams = Promise<Record<string, string | string[]>>;

export async function requireMenusAdmin(params: RouteParams, req?: NextRequest) {
  const resolvedParams = await params;
  const value = resolvedParams.id;
  const restaurantId = typeof value === 'string' ? value : (value?.[0] ?? null);
  if (!restaurantId) {
    return { response: NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 }) };
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'menus', req);
  if (auth instanceof NextResponse) {
    return { restaurantId, response: auth };
  }

  return { restaurantId, auth };
}

export async function resolveRouteParam(
  paramsPromise: RouteParams,
  key: string,
): Promise<string | null> {
  const params = await paramsPromise;
  const value = params[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  return request.json().catch(() => null);
}

export function invalidPayload(details: unknown) {
  return NextResponse.json({ error: 'Invalid payload', details }, { status: 400 });
}

export function routeError(scope: string, error: unknown, message: string) {
  console.error(`[ops][menus][${scope}] failed`, error);
  captureServerException(error, {
    properties: { source: 'ops', section: 'menus', kind: scope },
  });
  return NextResponse.json({ error: message }, { status: 500 });
}
