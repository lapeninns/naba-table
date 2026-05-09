import { NextResponse } from 'next/server';

import { DUAL_SYNC_RESTAURANT_PAUSED_CODE } from '@/server/dual-sync/controls';

export function dualSyncErrorResponse(
  message: string,
  status: number,
  code?: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      message,
      error: message,
      ...(code ? { code } : {}),
      ...extra,
    },
    { status },
  );
}

export function dualSyncUnavailableResponse() {
  return dualSyncErrorResponse(
    'Dual-sync is not enabled for this deployment.',
    404,
    'DUAL_SYNC_UNAVAILABLE',
  );
}

export function dualSyncPausedResponse(message = 'Dual-sync is paused for this restaurant.') {
  return dualSyncErrorResponse(message, 409, DUAL_SYNC_RESTAURANT_PAUSED_CODE);
}
