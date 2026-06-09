import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkSlotAvailabilityMock = vi.hoisted(() => vi.fn());
const findAlternativeSlotsMock = vi.hoisted(() => vi.fn());
const getActiveRestaurantIdMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const requireDashboardAccessMock = vi.hoisted(() => vi.fn());
const buildDashboardAccessErrorResponseMock = vi.hoisted(() => vi.fn());
const getTodayBookingsSummaryMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getAllCustomersWithHistoryMock = vi.hoisted(() => vi.fn());
const policyState = vi.hoisted(() => ({ combinationEnabled: true }));
const loadRestaurantTimezoneMock = vi.hoisted(() => vi.fn());
const loadTablesForRestaurantMock = vi.hoisted(() => vi.fn());
const loadAdjacencyMock = vi.hoisted(() => vi.fn());
const loadContextBookingsMock = vi.hoisted(() => vi.fn());
const loadActiveHoldsForDateMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity', () => ({
  checkSlotAvailability: checkSlotAvailabilityMock,
  findAlternativeSlots: findAlternativeSlotsMock,
}));

vi.mock('@/server/restaurants/getActiveRestaurantId', () => ({
  getActiveRestaurantId: getActiveRestaurantIdMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: (ip: string | null) => ip ?? 'unknown',
  extractClientIp: () => '203.0.113.10',
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/src/app/api/ops/dashboard/_shared', () => ({
  buildDashboardAccessErrorResponse: buildDashboardAccessErrorResponseMock,
  requireDashboardAccess: requireDashboardAccessMock,
}));

vi.mock('@/server/ops/bookings', () => ({
  getTodayBookingsSummary: getTodayBookingsSummaryMock,
}));

vi.mock('@/server/ops/customers', () => ({
  getAllCustomersWithHistory: getAllCustomersWithHistoryMock,
}));

vi.mock('@/server/supabase', () => ({
  MissingRestaurantContextError: class MissingRestaurantContextError extends Error {},
  getDefaultRestaurantId: vi.fn(),
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
}));

vi.mock('@/server/runtime-policy', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getAllocatorKMax: vi.fn(() => 3),
    getSelectorPlannerLimits: vi.fn(() => ({})),
    isCombinationPlannerEnabled: vi.fn(() => policyState.combinationEnabled),
    isHoldsEnabled: vi.fn(() => false),
    isPlannerTimePruningEnabled: vi.fn(() => false),
  };
});

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
}));

vi.mock('@/server/capacity/table-assignment/supabase', () => ({
  ensureClient: vi.fn((client?: unknown) => client ?? {}),
  loadActiveHoldsForDate: loadActiveHoldsForDateMock,
  loadAdjacency: loadAdjacencyMock,
  loadContextBookings: loadContextBookingsMock,
  loadRestaurantTimezone: loadRestaurantTimezoneMock,
  loadTablesForRestaurant: loadTablesForRestaurantMock,
}));

import { GET as availabilityGET } from '@/app/api/availability/route';
import {
  createBookingShortLink,
  resolveBookingShortLink,
} from '@/cloudflare/booking-short-links/src/core';
import bookingShortLinkWorker from '@/cloudflare/booking-short-links/src/index';
import smsSummaryWorker from '@/cloudflare/sms-summary-gateway/src/index';
import { checkRequestSeatability } from '@/server/capacity/seatability';
import { GET as customersExportGET } from '@/src/app/api/ops/customers/export/route';
import { GET as dashboardSummaryGET } from '@/src/app/api/ops/dashboard/summary/route';
import { groupEmailDeliveryEvents } from '@/src/lib/email-delivery/grouping';

import type { Table } from '@/server/capacity/table-assignment/types';
import type { EmailDeliveryEventDTO } from '@/types/emailDelivery';

type PerformanceThresholds = {
  availabilityEndpointMs: number;
  bookingCapacityPathMs: number;
  capacityPlannerFixtureMs: number;
  customersExportSeededMs: number;
  deliveryDashboardGroupingMs: number;
  opsDashboardSummaryMs: number;
  workerEndpointMs: number;
};

const thresholds = JSON.parse(
  readFileSync('config/qa/performance-thresholds.json', 'utf8'),
) as PerformanceThresholds;

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

async function expectWithinThreshold<T>(
  label: string,
  thresholdMs: number,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const result = await work();
  const durationMs = performance.now() - started;

  expect(durationMs, `${label} took ${durationMs.toFixed(1)}ms`).toBeLessThanOrEqual(thresholdMs);
  return result;
}

function makeTable(index: number): Table {
  return {
    active: true,
    capacity: 2 + (index % 4),
    id: `table-${index}`,
    mobility: index % 3 === 0 ? 'fixed' : 'movable',
    status: 'available',
    tableNumber: String(index + 1).padStart(2, '0'),
    zoneActive: true,
    zoneId: 'zone-main',
  };
}

function makeCustomer(index: number) {
  return {
    createdAt: '2026-05-01T10:00:00.000Z',
    email: `guest-${index}@example.com`,
    firstBookingAt: '2026-05-02T18:00:00.000Z',
    id: `customer-${index}`,
    lastVisitAt: '2026-05-03T18:00:00.000Z',
    marketingOptIn: index % 2 === 0,
    name: `Guest ${index}`,
    phone: `0770090${String(index).padStart(4, '0')}`,
    restaurantId: RESTAURANT_ID,
    totalBookings: index % 7,
    totalCancellations: index % 3,
    totalCovers: index % 20,
    updatedAt: '2026-05-01T10:00:00.000Z',
  };
}

function makeEmailEvent(index: number): EmailDeliveryEventDTO {
  return {
    bookingId: `booking-${index % 200}`,
    emailType: 'confirmation',
    error: null,
    id: `event-${index}`,
    messageId: `msg-${index % 500}`,
    metadata: index % 2 === 0 ? { subject: 'Booking confirmation' } : null,
    occurredAt: new Date(Date.UTC(2026, 4, 16, 12, index % 60, index % 60)).toISOString(),
    provider: 'resend',
    recipientEmail: `guest-${index % 500}@example.com`,
    restaurantId: RESTAURANT_ID,
    status: index % 5 === 0 ? 'delivered' : 'sent',
    templateType: 'confirmation',
  };
}

function makeBookingShortLinkWorkerEnv() {
  return {
    ALLOWED_DESTINATION_HOSTS: 'nabatable.com',
    BOOKING_SHORT_LINKS_DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => null),
          run: vi.fn(async () => undefined),
        })),
      })),
    },
    BOOKING_SITE_URL: 'https://nabatable.com',
    INTERNAL_LINKS_TOKEN: 'internal-links-token',
    SHORT_LINKS_PUBLIC_BASE_URL: 'https://go.nabatable.com',
  };
}

function makeSmsSummaryWorkerEnv() {
  return {
    DAILY_BOOKING_SUMMARY_QUEUE: {
      send: vi.fn(async () => undefined),
    },
    DAILY_BOOKING_SUMMARY_STATE: {
      get: vi.fn(() => ({
        fetch: vi.fn(async () => Response.json({ status: 'idle' })),
      })),
      idFromName: vi.fn((name: string) => name),
    },
    INTERNAL_TRIGGER_TOKEN: 'internal-trigger-token',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_URL: 'https://supabase.test',
    TWILIO_ACCOUNT_SID: 'AC123',
    TWILIO_API_KEY_SECRET: 'twilio-secret',
    TWILIO_API_KEY_SID: 'SK123',
    TWILIO_MESSAGING_SERVICE_SID: 'MG123',
  };
}

describe('QA performance smoke thresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireApiRateLimitMock.mockResolvedValue(null);
    getActiveRestaurantIdMock.mockResolvedValue(RESTAURANT_ID);
    checkSlotAvailabilityMock.mockResolvedValue({
      available: true,
      metadata: { servicePeriod: 'Dinner' },
      reason: null,
    });
    findAlternativeSlotsMock.mockResolvedValue([]);
    recordObservabilityEventMock.mockResolvedValue(undefined);

    requireDashboardAccessMock.mockResolvedValue(undefined);
    buildDashboardAccessErrorResponseMock.mockReturnValue(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    getTodayBookingsSummaryMock.mockResolvedValue({
      covers: 24,
      totalBookings: 12,
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({ service: true });
    fetchUserMembershipsMock.mockResolvedValue([
      {
        restaurant_id: RESTAURANT_ID,
        restaurants: { name: 'QA Venue' },
      },
    ]);
    getAllCustomersWithHistoryMock.mockResolvedValue(
      Array.from({ length: 1000 }, (_, index) => makeCustomer(index)),
    );

    policyState.combinationEnabled = true;
    loadRestaurantTimezoneMock.mockResolvedValue('Europe/London');
    loadTablesForRestaurantMock.mockResolvedValue(
      Array.from({ length: 24 }, (_, index) => makeTable(index)),
    );
    loadAdjacencyMock.mockResolvedValue(new Map());
    loadContextBookingsMock.mockResolvedValue([]);
    loadActiveHoldsForDateMock.mockResolvedValue([]);
    getRestaurantTurnBandsMock.mockResolvedValue({});
  });

  it('keeps public availability under the local smoke threshold', async () => {
    const response = await expectWithinThreshold(
      'availability endpoint',
      thresholds.availabilityEndpointMs,
      () =>
        availabilityGET(
          new NextRequest(
            `http://localhost/api/availability?restaurantId=${RESTAURANT_ID}&date=2026-05-16&time=19:00&partySize=2`,
          ),
        ),
    );

    expect(response.status).toBe(200);
  });

  it('keeps deterministic booking capacity checks under the local smoke threshold', async () => {
    const result = await expectWithinThreshold(
      'booking capacity path',
      thresholds.bookingCapacityPathMs,
      () =>
        checkRequestSeatability({
          bookingOption: 'dinner',
          date: '2026-05-16',
          partySize: 6,
          restaurantId: RESTAURANT_ID,
          time: '19:00',
        }),
    );

    expect(result.metadata.totalTables).toBe(24);
  });

  it('keeps the capacity planner fixture under the local smoke threshold', async () => {
    await expectWithinThreshold(
      'capacity planner fixture',
      thresholds.capacityPlannerFixtureMs,
      () =>
        checkRequestSeatability({
          bookingOption: 'dinner',
          date: '2026-05-17',
          partySize: 8,
          restaurantId: RESTAURANT_ID,
          time: '20:00',
        }),
    );
  });

  it('keeps ops dashboard summary under the local smoke threshold', async () => {
    const response = await expectWithinThreshold(
      'ops dashboard summary',
      thresholds.opsDashboardSummaryMs,
      () =>
        dashboardSummaryGET(
          new NextRequest(
            `https://app.nabatable.com/api/ops/dashboard/summary?restaurantId=${RESTAURANT_ID}&date=2026-05-16`,
          ),
        ),
    );

    expect(response.status).toBe(200);
  });

  it('keeps seeded customer CSV export under the local smoke threshold', async () => {
    const response = await expectWithinThreshold(
      'customers export',
      thresholds.customersExportSeededMs,
      () =>
        customersExportGET(
          new NextRequest(
            `https://app.nabatable.com/api/ops/customers/export?restaurantId=${RESTAURANT_ID}`,
          ),
        ),
    );

    expect(response.status).toBe(200);
    expect(new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()))).toContain(
      'Guest 999',
    );
  });

  it('keeps delivery dashboard grouping under the local smoke threshold', async () => {
    const groups = await expectWithinThreshold(
      'delivery dashboard grouping',
      thresholds.deliveryDashboardGroupingMs,
      async () =>
        groupEmailDeliveryEvents(Array.from({ length: 2000 }, (_, index) => makeEmailEvent(index))),
    );

    expect(groups.length).toBeGreaterThan(0);
  });

  it('keeps worker short-link core paths under the local smoke threshold', async () => {
    const repository = {
      findReusableLink: vi.fn().mockResolvedValue(null),
      getLinkByToken: vi.fn().mockResolvedValue({
        bookingId: 'booking-1',
        createdAt: '2026-05-16T12:00:00.000Z',
        createdBy: 'guest_confirmation_sms',
        destinationHost: 'nabatable.com',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
        expiresAt: '2099-01-01T00:00:00.000Z',
        lastAccessedAt: null,
        purpose: 'booking_manage',
        restaurantId: RESTAURANT_ID,
        revokedAt: null,
        token: 'ABC123',
      }),
      insertLink: vi.fn(),
      touchLink: vi.fn().mockResolvedValue(undefined),
    };

    await expectWithinThreshold('worker short-link core', thresholds.workerEndpointMs, async () => {
      await createBookingShortLink({
        randomBytes: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        repository,
        request: {
          bookingId: 'booking-1',
          createdBy: 'guest_confirmation_sms',
          destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
          expiresAt: '2099-01-01T00:00:00.000Z',
          purpose: 'booking_manage',
          restaurantId: RESTAURANT_ID,
        },
        shortBaseUrl: 'https://go.nabatable.com',
      });
      return resolveBookingShortLink({ repository, token: 'ABC123' });
    });
  });

  it('@p3 @performance @worker keeps worker health endpoints under the local smoke threshold', async () => {
    const responses = await expectWithinThreshold(
      'worker health endpoints',
      thresholds.workerEndpointMs,
      async () =>
        Promise.all([
          bookingShortLinkWorker.fetch(
            new Request('https://go.nabatable.test/health'),
            makeBookingShortLinkWorkerEnv(),
          ),
          smsSummaryWorker.fetch(
            new Request('https://sms-summary.nabatable.test/health'),
            makeSmsSummaryWorkerEnv(),
          ),
        ]),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await expect(responses[0]?.json()).resolves.toMatchObject({
      service: 'booking-short-links',
      status: 'ok',
    });
    await expect(responses[1]?.json()).resolves.toMatchObject({
      ok: true,
      service: 'sms-summary-gateway',
    });
  });

  it('keeps threshold coverage explicit for each Sprint 15 target', () => {
    expect(Object.keys(thresholds).sort()).toEqual([
      'availabilityEndpointMs',
      'bookingCapacityPathMs',
      'capacityPlannerFixtureMs',
      'customersExportSeededMs',
      'deliveryDashboardGroupingMs',
      'opsDashboardSummaryMs',
      'workerEndpointMs',
    ]);
    expect(Object.values(thresholds).every((value) => Number.isFinite(value) && value > 0)).toBe(
      true,
    );
  });
});
