import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveRestaurantIdMock = vi.hoisted(() => vi.fn(async () => 'rest-1'));
const ensureRestaurantAdminAccessMock = vi.hoisted(() =>
  vi.fn(async () => ({ userId: 'user-1', userEmail: 'owner@example.test' })),
);
const verifyPasswordMock = vi.hoisted(() => vi.fn());
const setWriteAccessMock = vi.hoisted(() => vi.fn());
const loadStateMock = vi.hoisted(() => vi.fn());
const getConnectionMock = vi.hoisted(() => vi.fn());
const getServiceClientMock = vi.hoisted(() => vi.fn(() => ({ rpc: vi.fn() })));

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  resolveRestaurantId: resolveRestaurantIdMock,
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
}));
vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: class PasswordConfirmationError extends Error {
    readonly code = 'PASSWORD_CONFIRMATION_INVALID';
    readonly status = 401;
  },
  verifyUserPasswordConfirmation: verifyPasswordMock,
}));
vi.mock('@/server/dual-sync/freshness/operator-connection-state', () => ({
  GbpWriteAccessTransitionError: class GbpWriteAccessTransitionError extends Error {
    readonly code = 'GBP_WRITE_ACCESS_REJECTED';
    readonly status = 409;
  },
  loadGbpOperatorConnectionState: loadStateMock,
  setGbpOperatorWriteAccess: setWriteAccessMock,
}));
vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileConnectionState: getConnectionMock,
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceClientMock }));

import { PUT } from '@/app/api/ops/restaurants/[id]/google-business-profile/write-access/route';

const state = {
  version: 'v1',
  restaurantId: 'rest-1',
  provider: 'google_business_profile',
  connectionStatus: 'linked',
  writeState: 'eligible',
  connectionGeneration: 2,
  consentEpoch: 3,
  reasonCode: 'owner_enabled',
  rollout: { eligible: true, cohort: 'all', evaluatedAt: '2026-08-09T10:00:00.000Z' },
  pendingUpdates: { version: 'v1', restaurantId: 'rest-1', state: 'none' },
  notifications: { enabled: false, refCount: 0 },
  refresh: {
    status: 'succeeded',
    lastAttemptAt: '2026-08-09T09:55:00.000Z',
    lastSucceededAt: '2026-08-09T09:55:00.000Z',
    safeErrorCode: null,
  },
};

describe('GBP write access route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionMock.mockResolvedValue({ status: 'linked' });
    loadStateMock.mockResolvedValue(state);
  });

  it('password-confirms the admin and returns the strict current connection state', async () => {
    const response = await PUT(
      new NextRequest('https://example.test', {
        method: 'PUT',
        body: JSON.stringify({ eligible: true, password: 'confirmed-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(verifyPasswordMock).toHaveBeenCalledWith({
      email: 'owner@example.test',
      password: 'confirmed-password',
    });
    expect(setWriteAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        actorUserId: 'user-1',
        enabled: true,
      }),
    );
    await expect(response.json()).resolves.toEqual(state);
  });

  it('rejects non-strict payloads before password confirmation or mutation', async () => {
    const response = await PUT(
      new NextRequest('https://example.test', {
        method: 'PUT',
        body: JSON.stringify({ eligible: false, password: 'confirmed-password', extra: true }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(setWriteAccessMock).not.toHaveBeenCalled();
  });

  it('uses a safe error when the current fence or rollout rejects the transition', async () => {
    const ErrorType = (await import('@/server/dual-sync/freshness/operator-connection-state'))
      .GbpWriteAccessTransitionError;
    setWriteAccessMock.mockRejectedValueOnce(new ErrorType());

    const response = await PUT(
      new NextRequest('https://example.test', {
        method: 'PUT',
        body: JSON.stringify({ eligible: true, password: 'confirmed-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'GBP_WRITE_ACCESS_REJECTED' });
  });
});
