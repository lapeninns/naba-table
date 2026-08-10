import { describe, expect, it, vi } from 'vitest';

const deliverMock = vi.hoisted(() => vi.fn());
const censusMock = vi.hoisted(() => vi.fn());
const reconcileMock = vi.hoisted(() => vi.fn());
const persistenceMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn(async () => undefined));
const getServiceClientMock = vi.hoisted(() => vi.fn(() => ({ service: true })));

vi.mock('@/server/security/cron-auth', () => ({
  requireCronAuthAndRun: vi.fn(
    async (
      _request: Request,
      _jobName: string,
      run: (auth: { readonly runId: string }) => Promise<Response>,
    ) => run({ runId: 'run-1' }),
  ),
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceClientMock }));
vi.mock('@/server/dual-sync/notifications', () => ({
  buildDefaultNotificationPort: vi.fn(() => ({ emit: emitMock })),
  createSupabaseGoogleWriteTerminalNoticePersistence: persistenceMock,
  deliverClaimedGoogleWriteNotices: deliverMock,
  getGoogleWriteTerminalNoticeCensus: censusMock,
  reconcileGoogleWriteTerminalNotices: reconcileMock,
}));

import { GET } from '@/app/api/cron/dual-sync/notifications/route';

describe('dual-sync terminal notification cron', () => {
  it('caps claims, delivers with a lease, and emits count-only overdue SLA telemetry', async () => {
    // Given
    const persistence = { claim: vi.fn(), finalize: vi.fn() };
    persistenceMock.mockReturnValue(persistence);
    reconcileMock.mockResolvedValue({ considered: 2, materialized: 1, failed: 0 });
    deliverMock.mockResolvedValue({ claimed: 2, delivered: 1, failed: 1 });
    censusMock.mockResolvedValue({
      overdue_count: 3,
      pending_count: 4,
      dispatched_count: 1,
      outcome_unknown_count: 2,
    });

    // When
    const response = await GET(
      new Request('https://example.test/api/cron/dual-sync/notifications?limit=999'),
    );
    const body = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(reconcileMock).toHaveBeenCalledWith(
      expect.objectContaining({ client: { service: true }, limit: 100, now: expect.any(String) }),
    );
    expect(deliverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        persistence,
        workerId: 'run-1',
        limit: 100,
        leaseSeconds: 60,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'google_write_notice_overdue',
        counts: { failed: 3 },
        metadata: { overdueCount: 3 },
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'google_write_notice_delivery_uncertain',
        counts: { failed: 2, other: 1 },
        metadata: {
          dispatchedCount: 1,
          outcomeUnknownCount: 2,
          instruction: 'check_in_app_notice_and_verify_operational_channel',
        },
      }),
    );
    expect(body).toMatchObject({
      success: true,
      limit: 100,
      reconciliation: { considered: 2, materialized: 1, failed: 0 },
      delivery: { claimed: 2, delivered: 1, failed: 1 },
      census: { overdue_count: 3 },
    });
  });
});
