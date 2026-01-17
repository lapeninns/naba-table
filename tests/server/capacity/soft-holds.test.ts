import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  acquireSoftHolds,
  releaseSoftHolds,
  checkSoftHoldOwnership,
  cleanupExpiredSoftHolds,
  SoftHoldConflictError,
  SoftHoldExpiredError,
  SOFT_HOLD_DEFAULT_TTL_SECONDS,
  SOFT_HOLD_MAX_TTL_SECONDS,
  SOFT_HOLD_MIN_TTL_SECONDS,
} from '@/server/capacity/table-assignment/soft-holds';

// Mock the Supabase client
const mockRpc = vi.fn();
const mockSupabaseClient = {
  rpc: mockRpc,
};

vi.mock('@/server/capacity/table-assignment/supabase', () => ({
  ensureClient: () => mockSupabaseClient,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
}));

vi.mock('@/server/feature-flags', () => ({
  isSoftHoldsEnabled: () => true,
}));

describe('soft-holds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('acquireSoftHolds', () => {
    it('throws error when tableIds is empty', async () => {
      await expect(
        acquireSoftHolds({
          tableIds: [],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
          restaurantId: 'rest-1',
        }),
      ).rejects.toThrow('acquireSoftHolds requires at least one table ID');
    });

    it('acquires soft-holds successfully', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            table_id: 'table-1',
            acquired: true,
            blocking_session: null,
            blocking_expires_at: null,
          },
          {
            table_id: 'table-2',
            acquired: true,
            blocking_session: null,
            blocking_expires_at: null,
          },
        ],
        error: null,
      });

      const result = await acquireSoftHolds({
        tableIds: ['table-1', 'table-2'],
        window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        restaurantId: 'rest-1',
        bookingId: 'booking-1',
      });

      expect(result.allAcquired).toBe(true);
      expect(result.acquiredTables).toEqual(['table-1', 'table-2']);
      expect(result.blockedTables).toEqual([]);
      expect(result.sessionToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws SoftHoldConflictError when tables are blocked', async () => {
      const blockingExpiresAt = new Date(Date.now() + 5000).toISOString();
      mockRpc.mockResolvedValue({
        data: [
          {
            table_id: 'table-1',
            acquired: true,
            blocking_session: null,
            blocking_expires_at: null,
          },
          {
            table_id: 'table-2',
            acquired: false,
            blocking_session: 'other-session-123',
            blocking_expires_at: blockingExpiresAt,
          },
        ],
        error: null,
      });

      await expect(
        acquireSoftHolds({
          tableIds: ['table-1', 'table-2'],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
          restaurantId: 'rest-1',
        }),
      ).rejects.toThrow(SoftHoldConflictError);

      try {
        await acquireSoftHolds({
          tableIds: ['table-1', 'table-2'],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
          restaurantId: 'rest-1',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(SoftHoldConflictError);
        if (error instanceof SoftHoldConflictError) {
          expect(error.blockedTables).toHaveLength(1);
          expect(error.blockedTables[0].tableId).toBe('table-2');
          expect(error.blockedTables[0].blockingSession).toBe('other-session-123');
        }
      }
    });

    it('passes correct parameters to RPC', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            table_id: 'table-1',
            acquired: true,
            blocking_session: null,
            blocking_expires_at: null,
          },
        ],
        error: null,
      });

      await acquireSoftHolds({
        tableIds: ['table-1'],
        window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        restaurantId: 'rest-1',
        bookingId: 'booking-1',
        ttlSeconds: 15,
      });

      expect(mockRpc).toHaveBeenCalledWith('acquire_soft_holds_atomic', {
        p_table_ids: ['table-1'],
        p_window: '[2026-01-01T18:00:00Z,2026-01-01T20:00:00Z)',
        p_session_token: expect.any(String),
        p_restaurant_id: 'rest-1',
        p_booking_id: 'booking-1',
        p_ttl_seconds: 15,
      });
    });

    it('clamps TTL to valid range', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            table_id: 'table-1',
            acquired: true,
            blocking_session: null,
            blocking_expires_at: null,
          },
        ],
        error: null,
      });

      // Test max TTL clamping
      await acquireSoftHolds({
        tableIds: ['table-1'],
        window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        restaurantId: 'rest-1',
        ttlSeconds: 100, // Above max
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'acquire_soft_holds_atomic',
        expect.objectContaining({ p_ttl_seconds: SOFT_HOLD_MAX_TTL_SECONDS }),
      );

      mockRpc.mockClear();

      // Test min TTL clamping
      await acquireSoftHolds({
        tableIds: ['table-1'],
        window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        restaurantId: 'rest-1',
        ttlSeconds: 1, // Below min
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'acquire_soft_holds_atomic',
        expect.objectContaining({ p_ttl_seconds: SOFT_HOLD_MIN_TTL_SECONDS }),
      );
    });

    it('throws error when RPC fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        acquireSoftHolds({
          tableIds: ['table-1'],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
          restaurantId: 'rest-1',
        }),
      ).rejects.toThrow('Failed to acquire soft-holds: Database error');
    });
  });

  describe('releaseSoftHolds', () => {
    it('releases soft-holds by session token', async () => {
      mockRpc.mockResolvedValue({ data: 2, error: null });

      const released = await releaseSoftHolds({
        sessionToken: 'session-123',
      });

      expect(released).toBe(2);
      expect(mockRpc).toHaveBeenCalledWith('release_soft_holds', {
        p_session_token: 'session-123',
        p_table_ids: null,
      });
    });

    it('releases specific tables when tableIds provided', async () => {
      mockRpc.mockResolvedValue({ data: 1, error: null });

      const released = await releaseSoftHolds({
        sessionToken: 'session-123',
        tableIds: ['table-1'],
      });

      expect(released).toBe(1);
      expect(mockRpc).toHaveBeenCalledWith('release_soft_holds', {
        p_session_token: 'session-123',
        p_table_ids: ['table-1'],
      });
    });

    it('returns 0 when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const released = await releaseSoftHolds({
        sessionToken: 'session-123',
      });

      expect(released).toBe(0);
    });
  });

  describe('checkSoftHoldOwnership', () => {
    it('returns ownership status for tables', async () => {
      const expiresAt = new Date(Date.now() + 5000).toISOString();
      mockRpc.mockResolvedValue({
        data: [
          { table_id: 'table-1', owned: true, expires_at: expiresAt },
          { table_id: 'table-2', owned: true, expires_at: expiresAt },
        ],
        error: null,
      });

      const result = await checkSoftHoldOwnership({
        sessionToken: 'session-123',
        tableIds: ['table-1', 'table-2'],
        window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].tableId).toBe('table-1');
      expect(result[0].owned).toBe(true);
      expect(result[0].expiresAt).toBeInstanceOf(Date);
    });

    it('throws SoftHoldExpiredError when soft-holds have expired', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { table_id: 'table-1', owned: true, expires_at: null },
          { table_id: 'table-2', owned: false, expires_at: null }, // Expired/not owned
        ],
        error: null,
      });

      await expect(
        checkSoftHoldOwnership({
          sessionToken: 'session-123',
          tableIds: ['table-1', 'table-2'],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        }),
      ).rejects.toThrow(SoftHoldExpiredError);

      try {
        await checkSoftHoldOwnership({
          sessionToken: 'session-123',
          tableIds: ['table-1', 'table-2'],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(SoftHoldExpiredError);
        if (error instanceof SoftHoldExpiredError) {
          expect(error.expiredTables).toEqual(['table-2']);
          expect(error.sessionToken).toBe('session-123');
        }
      }
    });

    it('throws error when RPC fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        checkSoftHoldOwnership({
          sessionToken: 'session-123',
          tableIds: ['table-1'],
          window: { startAt: '2026-01-01T18:00:00Z', endAt: '2026-01-01T20:00:00Z' },
        }),
      ).rejects.toThrow('Failed to check soft-hold ownership: Database error');
    });
  });

  describe('cleanupExpiredSoftHolds', () => {
    it('cleans up expired soft-holds', async () => {
      mockRpc.mockResolvedValue({ data: 5, error: null });

      const cleaned = await cleanupExpiredSoftHolds();

      expect(cleaned).toBe(5);
      expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_soft_holds', {
        p_batch_size: 1000,
      });
    });

    it('uses custom batch size', async () => {
      mockRpc.mockResolvedValue({ data: 10, error: null });

      const cleaned = await cleanupExpiredSoftHolds({ batchSize: 500 });

      expect(cleaned).toBe(10);
      expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_soft_holds', {
        p_batch_size: 500,
      });
    });

    it('returns 0 when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const cleaned = await cleanupExpiredSoftHolds();

      expect(cleaned).toBe(0);
    });
  });

  describe('constants', () => {
    it('has correct default TTL', () => {
      expect(SOFT_HOLD_DEFAULT_TTL_SECONDS).toBe(10);
    });

    it('has correct max TTL', () => {
      expect(SOFT_HOLD_MAX_TTL_SECONDS).toBe(30);
    });

    it('has correct min TTL', () => {
      expect(SOFT_HOLD_MIN_TTL_SECONDS).toBe(5);
    });
  });
});
