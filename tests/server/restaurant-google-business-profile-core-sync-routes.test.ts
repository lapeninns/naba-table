import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const verifyUserPasswordConfirmationMock = vi.hoisted(() => vi.fn());
const syncRestaurantProfileWithGoogleBusinessProfileMock = vi.hoisted(() => vi.fn());
const syncRestaurantOperatingHoursWithGoogleBusinessProfileMock = vi.hoisted(() => vi.fn());
const syncRestaurantServicePeriodsWithGoogleBusinessProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/auth/supabase-auth-errors', () => ({
  mapSupabaseAuthError: vi.fn((error: { message?: string; status?: number }) => ({
    message: error.message ?? 'Authentication failed',
    status: error.status ?? 401,
    code: 'AUTH_FAILED',
  })),
}));

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: class PasswordConfirmationError extends Error {
    code: string;
    status: number;

    constructor(message: string, options: { code?: string; status?: number } = {}) {
      super(message);
      this.code = options.code ?? 'PASSWORD_CONFIRMATION_FAILED';
      this.status = options.status ?? 403;
    }
  },
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  syncRestaurantProfileWithGoogleBusinessProfile:
    syncRestaurantProfileWithGoogleBusinessProfileMock,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile:
    syncRestaurantOperatingHoursWithGoogleBusinessProfileMock,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile:
    syncRestaurantServicePeriodsWithGoogleBusinessProfileMock,
}));

import { POST as detailsPOST } from '@/src/app/api/ops/restaurants/[id]/details/route';
import { POST as hoursPOST } from '@/src/app/api/ops/restaurants/[id]/hours/route';
import { POST as servicePeriodsPOST } from '@/src/app/api/ops/restaurants/[id]/service-periods/route';

describe('restaurant GBP core sync routes', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    requireAdminMembershipMock.mockReset();
    verifyUserPasswordConfirmationMock.mockReset();
    syncRestaurantProfileWithGoogleBusinessProfileMock.mockReset();
    syncRestaurantOperatingHoursWithGoogleBusinessProfileMock.mockReset();
    syncRestaurantServicePeriodsWithGoogleBusinessProfileMock.mockReset();

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              email: 'owner@example.com',
            },
          },
          error: null,
        }),
      },
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
  });

  it('requires a password for profile sync actions', async () => {
    const response = await detailsPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/details', {
        method: 'POST',
        body: JSON.stringify({
          direction: 'pull_from_gbp',
          fields: ['name'],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(verifyUserPasswordConfirmationMock).not.toHaveBeenCalled();
    expect(syncRestaurantProfileWithGoogleBusinessProfileMock).not.toHaveBeenCalled();
  });

  it('verifies the password and forwards selected profile fields', async () => {
    syncRestaurantProfileWithGoogleBusinessProfileMock.mockResolvedValue({
      id: 'rest-1',
      name: 'Old Crown Girton',
      slug: 'old-crown-girton',
      timezone: 'Europe/London',
      capacity: 120,
      contactEmail: null,
      contactPhone: '+441223277217',
      address: '89 High Street',
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      emailSendReminder24h: true,
      emailSendReminderShort: true,
      emailSendReviewRequest: true,
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
      isActive: true,
      updatedAt: '2026-04-18T13:00:00.000Z',
    });

    const response = await detailsPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/details', {
        method: 'POST',
        body: JSON.stringify({
          direction: 'push_to_gbp',
          fields: ['name', 'contactPhone'],
          password: 'correct-password',
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(verifyUserPasswordConfirmationMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct-password',
    });
    expect(syncRestaurantProfileWithGoogleBusinessProfileMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      direction: 'push_to_gbp',
      fields: ['name', 'contactPhone'],
    });
  });

  it('forwards selected operating-hours rows after password confirmation', async () => {
    syncRestaurantOperatingHoursWithGoogleBusinessProfileMock.mockResolvedValue({
      weekly: [],
      overrides: [],
      updatedAt: '2026-04-18T13:00:00.000Z',
    });

    const response = await hoursPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/hours', {
        method: 'POST',
        body: JSON.stringify({
          direction: 'pull_from_gbp',
          password: 'correct-password',
          selection: {
            weeklyDays: [0, 1],
            overrideDates: ['2026-12-25'],
          },
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(syncRestaurantOperatingHoursWithGoogleBusinessProfileMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      direction: 'pull_from_gbp',
      selection: {
        weeklyDays: [0, 1],
        overrideDates: ['2026-12-25'],
      },
    });
  });

  it('forwards selected service-period days after password confirmation', async () => {
    syncRestaurantServicePeriodsWithGoogleBusinessProfileMock.mockResolvedValue([]);

    const response = await servicePeriodsPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/service-periods', {
        method: 'POST',
        body: JSON.stringify({
          direction: 'push_to_gbp',
          password: 'correct-password',
          selection: {
            dayOfWeeks: [0, 6],
          },
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(syncRestaurantServicePeriodsWithGoogleBusinessProfileMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      direction: 'push_to_gbp',
      selection: {
        dayOfWeeks: [0, 6],
      },
    });
  });
});
