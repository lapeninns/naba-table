import { NextResponse } from 'next/server';

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
