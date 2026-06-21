/**
 * Phase 3k of the unified dual-sync engine.
 *
 * GET /api/ops/restaurants/{id}/dual-sync/operations
 *
 * Returns a list of recent `dual_sync_publish_operations` rows for the
 * restaurant, newest-first. Powers the operations dashboard / audit
 * panel inside the dual-sync shell.
 *
 * Query params (all optional):
 *  - `limit` (1..200, default 50)
 *  - `since` (ISO-8601 timestamp; rows older than this are dropped)
 *  - `status` (comma-separated list of statuses)
 *  - `direction` (`import_from_google` | `export_to_google`)
 */

import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { listRecentOperationsForRestaurant } from '@/server/dual-sync/publish/operations';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { DualSyncPublishOperationStatus } from '@/server/dual-sync';
import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

const VALID_STATUSES: ReadonlyArray<DualSyncPublishOperationStatus> = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'retrying',
];

function parseStatuses(
  raw: string | null,
): ReadonlyArray<DualSyncPublishOperationStatus> | undefined {
  if (!raw) return undefined;
  const out: DualSyncPublishOperationStatus[] = [];
  for (const piece of raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    if ((VALID_STATUSES as ReadonlyArray<string>).includes(piece)) {
      out.push(piece as DualSyncPublishOperationStatus);
    }
  }
  return out.length > 0 ? out : undefined;
}

function parseDirection(raw: string | null): 'import_from_google' | 'export_to_google' | undefined {
  if (raw === 'import_from_google' || raw === 'export_to_google') return raw;
  return undefined;
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseSince(raw: string | null): string | null {
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-operations');
  if (access instanceof NextResponse) return access;

  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const since = parseSince(url.searchParams.get('since'));
    const statuses = parseStatuses(url.searchParams.get('status'));
    const direction = parseDirection(url.searchParams.get('direction'));

    const operations = await listRecentOperationsForRestaurant({
      client: getServiceSupabaseClient(),
      restaurantId,
      limit,
      since,
      statuses,
      direction,
    });

    return NextResponse.json({ restaurantId, operations }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load operations';
    captureServerException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'dual-sync-operations' },
    });
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_OPERATIONS_ERROR');
  }
}

export const runtime = 'nodejs';
