import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn().mockResolvedValue(undefined),
}));

// The opportunistic sweep is throttled via module-local state. Re-import the module
// fresh in each test (after resetModules) so that throttle state never leaks across
// tests — otherwise one test's sweep would throttle the next.
let releaseSoftHolds: typeof import('@/server/capacity/table-assignment/soft-holds').releaseSoftHolds;

type RpcCall = { fn: string; args: unknown };

function makeSoftHoldClient(overrides?: {
  releaseResult?: { data: unknown; error: { message: string } | null };
  cleanupResult?: { data: unknown; error: { message: string } | null };
}) {
  const calls: RpcCall[] = [];
  const releaseResult = overrides?.releaseResult ?? { data: 0, error: null };
  const cleanupResult = overrides?.cleanupResult ?? { data: 3, error: null };

  return {
    calls,
    rpc: vi.fn(async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (fn === 'cleanup_expired_soft_holds') {
        return cleanupResult;
      }
      return releaseResult;
    }),
  };
}

/**
 * Regression for #21: releaseSoftHolds is caller-driven with no finally/abort
 * cleanup, so aborted sessions leave member rows lingering until TTL. The fix
 * piggy-backs a best-effort, throttled sweep of EXPIRED members onto release
 * calls so abandoned sessions get reaped opportunistically.
 */
describe('releaseSoftHolds defensive expired-member cleanup', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Start well past the throttle window so the first call always sweeps.
    vi.setSystemTime(new Date('2026-06-19T00:00:00.000Z'));
    ({ releaseSoftHolds } = await import('@/server/capacity/table-assignment/soft-holds'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs an expired-member sweep after releasing (defensive cleanup path)', async () => {
    const client = makeSoftHoldClient();

    const count = await releaseSoftHolds({
      sessionToken: 'session-1',
      client: client as never,
    });

    // Release result is still returned correctly.
    expect(count).toBe(0);

    const cleanupCalls = client.calls.filter((c) => c.fn === 'cleanup_expired_soft_holds');
    expect(cleanupCalls).toHaveLength(1);
  });

  it('still sweeps even when the release RPC itself errors', async () => {
    const client = makeSoftHoldClient({
      releaseResult: { data: null, error: { message: 'release failed' } },
    });

    const count = await releaseSoftHolds({
      sessionToken: 'session-err',
      client: client as never,
    });

    // Error in release surfaces as 0, but the defensive sweep still runs.
    expect(count).toBe(0);
    expect(client.calls.some((c) => c.fn === 'cleanup_expired_soft_holds')).toBe(true);
  });

  it('throttles the sweep so a burst of releases does not hammer the cleanup RPC', async () => {
    const client = makeSoftHoldClient();

    // First release (advanced past the throttle window) sweeps.
    await releaseSoftHolds({ sessionToken: 's1', client: client as never });
    // Immediate second release within the throttle window must NOT sweep again.
    await releaseSoftHolds({ sessionToken: 's2', client: client as never });

    const cleanupCalls = client.calls.filter((c) => c.fn === 'cleanup_expired_soft_holds');
    expect(cleanupCalls).toHaveLength(1);

    // Advance beyond the throttle window: the next release sweeps again.
    vi.setSystemTime(new Date('2026-06-19T00:01:00.000Z'));
    await releaseSoftHolds({ sessionToken: 's3', client: client as never });

    expect(client.calls.filter((c) => c.fn === 'cleanup_expired_soft_holds')).toHaveLength(2);
  });

  it('never throws if the defensive sweep itself fails', async () => {
    const client = makeSoftHoldClient({
      cleanupResult: { data: null, error: { message: 'cleanup boom' } },
    });

    await expect(
      releaseSoftHolds({ sessionToken: 'session-2', client: client as never }),
    ).resolves.toBe(0);
  });
});
