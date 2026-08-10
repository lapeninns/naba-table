import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const resolveRestaurantIdMock = vi.hoisted(() => vi.fn(async () => 'rest-1'));
const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn(async () => ({ userId: 'user-1' })));
const censusMock = vi.hoisted(() => vi.fn());
const getServiceClientMock = vi.hoisted(() => vi.fn());
const verifyPasswordMock = vi.hoisted(() => vi.fn());
const setParticipationMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: class PasswordConfirmationError extends Error {
    readonly code = 'PASSWORD_CONFIRMATION_INVALID';
    readonly status = 401;
  },
  verifyUserPasswordConfirmation: verifyPasswordMock,
}));

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  resolveRestaurantId: resolveRestaurantIdMock,
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
}));
vi.mock('@/server/dual-sync/notifications', () => ({
  getGoogleWriteTerminalNoticeCensus: censusMock,
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceClientMock }));
vi.mock('@/server/google-business-profile/service', () => ({
  setGoogleBusinessProfileNotificationParticipation: setParticipationMock,
}));

import {
  GET,
  PUT,
} from '@/app/api/ops/restaurants/[id]/google-business-profile/notifications/route';
import { PasswordConfirmationError } from '@/server/auth/password-confirmation';

describe('Google write terminal notifications route', () => {
  it('returns tenant-scoped safe notice metadata and SLA census with no-store headers', async () => {
    // Given
    const query: Record<string, unknown> = {};
    const fluent = vi.fn(() => query);
    Object.assign(query, {
      select: fluent,
      eq: fluent,
      order: fluent,
      limit: vi.fn(async () => ({
        data: [
          {
            id: 'notice-1',
            grant_id: 'grant-1',
            event_id: 'event-1',
            terminal_kind: 'outcome_unknown',
            safe_reason_code: 'provider_outcome_unknown',
            requires_fresh_preview: true,
            status: 'outcome_unknown',
            terminal_at: '2026-08-09T10:00:00.000Z',
            due_at: '2026-08-11T10:00:00.000Z',
            dispatched_at: '2026-08-09T10:01:00.000Z',
            outcome_unknown_at: '2026-08-09T10:03:00.000Z',
            delivered_at: null,
            failed_at: null,
            last_error_code: 'dispatch_finalize_missing',
            created_at: '2026-08-09T10:00:00.000Z',
          },
        ],
        error: null,
      })),
    });
    getServiceClientMock.mockReturnValue({ from: vi.fn(() => query) });
    censusMock.mockResolvedValue({
      pending_count: 0,
      overdue_count: 0,
      claimed_count: 0,
      dispatched_count: 0,
      outcome_unknown_count: 1,
      delivered_count: 0,
      failed_count: 0,
      oldest_pending_at: null,
    });

    // When
    const response = await GET(new NextRequest('https://example.test'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });
    const body = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(query.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(body).toMatchObject({
      notices: [
        {
          terminal_kind: 'outcome_unknown',
          requires_fresh_preview: true,
          status: 'outcome_unknown',
          providerInstruction: 'refresh_then_create_new_preview',
          operationalDeliveryInstruction: 'in_app_notice_available_verify_operational_channel',
        },
      ],
      census: { pending_count: 0, overdue_count: 0, outcome_unknown_count: 1 },
    });
    expect(JSON.stringify(body)).not.toContain('providerBody');
  });

  it('password-confirms an admin before enabling account participation', async () => {
    // Given
    ensureRestaurantAdminAccessMock.mockResolvedValueOnce({
      userId: 'user-1',
      userEmail: 'operator@example.test',
    });
    setParticipationMock.mockResolvedValue({ enabled: true, refCount: 1 });
    const request = new NextRequest('https://example.test', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true, password: 'confirmed-password' }),
    });

    // When
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    // Then
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(verifyPasswordMock).toHaveBeenCalledWith({
      email: 'operator@example.test',
      password: 'confirmed-password',
    });
    expect(setParticipationMock).toHaveBeenCalledWith('rest-1', true);
    await expect(response.json()).resolves.toEqual({ enabled: true, refCount: 1 });
  });

  it('does not call participation when password confirmation fails', async () => {
    // Given
    ensureRestaurantAdminAccessMock.mockResolvedValueOnce({
      userId: 'user-1',
      userEmail: 'operator@example.test',
    });
    const passwordError = new PasswordConfirmationError('Incorrect password.');
    verifyPasswordMock.mockRejectedValueOnce(passwordError);

    // When
    const response = await PUT(
      new NextRequest('https://example.test', {
        method: 'PUT',
        body: JSON.stringify({ enabled: false, password: 'wrong-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    // Then
    expect(response.status).toBe(401);
    expect(setParticipationMock).not.toHaveBeenCalled();
  });
});
