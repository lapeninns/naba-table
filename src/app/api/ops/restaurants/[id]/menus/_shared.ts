import { NextResponse } from 'next/server';

import {
  apiError,
  conflict,
  internalError,
  notFound,
  validationError,
  type ApiErrorBody,
} from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { MenuHierarchyError } from '@/server/menu-hierarchy/errors';

import { ensureRestaurantAdminAccess } from '../_shared';

import type { NextRequest } from 'next/server';

type RouteParams = Promise<Record<string, string | string[]>>;

export async function requireMenusAdmin(params: RouteParams, req?: NextRequest) {
  const resolvedParams = await params;
  const value = resolvedParams.id;
  const restaurantId = typeof value === 'string' ? value : (value?.[0] ?? null);
  if (!restaurantId) {
    return { response: missingParam('restaurant id') };
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

const PARAM_LABELS = {
  menuId: 'menu id',
  sectionId: 'section id',
  itemId: 'item id',
  optionId: 'option id',
} as const;

type MenuParamKey = keyof typeof PARAM_LABELS;

/** Resolves the named route params, or a C1 400 for the first one that is missing. */
export async function resolveMenuParams<const Keys extends readonly MenuParamKey[]>(
  params: RouteParams,
  keys: Keys,
): Promise<
  | { values: Record<Keys[number], string>; response?: undefined }
  | { values?: undefined; response: NextResponse<ApiErrorBody> }
> {
  const values = {} as Record<Keys[number], string>;
  for (const key of keys) {
    const value = await resolveRouteParam(params, key);
    if (!value) return { response: missingParam(PARAM_LABELS[key]) };
    values[key as Keys[number]] = value;
  }
  return { values };
}

export function missingParam(label: string) {
  return apiError(400, 'MISSING_PARAMETER', `Missing ${label}.`);
}

export function invalidJson() {
  return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  return request.json().catch(() => null);
}

export function invalidPayload(error: Parameters<typeof validationError>[0]) {
  return validationError(error);
}

/**
 * Maps menu hierarchy failures to C1 responses. Known domain errors get specific codes; anything
 * else is reported and logged (sanitised, through lib/logger) and returns the generic 500.
 */
export function routeError(scope: string, error: unknown, message?: string) {
  if (error instanceof MenuHierarchyError) {
    switch (error.kind) {
      case 'not_found':
        return notFound(
          'MENU_NOT_FOUND',
          'This menu entry no longer exists. Refresh and try again.',
        );
      case 'duplicate':
        return conflict('MENU_DUPLICATE', 'An entry with the same ID already exists.');
      case 'order_stale':
        return conflict(
          'MENU_ORDER_STALE',
          'The menu changed since you loaded it. Refresh and try again.',
        );
      case 'idempotency_key_reused':
        return conflict(
          'IDEMPOTENCY_KEY_REUSED',
          'This save was already used for a different request. Try again.',
        );
      case 'invalid_argument':
        return apiError(400, 'MENU_INVALID', 'Some menu details are not valid.');
    }
  }

  captureServerException(error, {
    properties: { source: 'ops', section: 'menus', kind: scope },
  });
  return internalError(error, { route: `ops.menus.${scope}` }, message);
}
