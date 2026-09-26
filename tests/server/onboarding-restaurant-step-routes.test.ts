import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const createZoneMock = vi.hoisted(() => vi.fn());
const insertTableMock = vi.hoisted(() => vi.fn());
const getOnboardingReadinessMock = vi.hoisted(() => vi.fn());
const replaceOnboardingLayoutMock = vi.hoisted(() => vi.fn());
const updateOnboardingProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

// Keep the real guard chain (withRestaurantAuthorization -> requireSession ->
// requireRestaurantMember) and stub only the membership lookup underneath it,
// so the shared onboarding auth model is exercised end-to-end.
vi.mock('@/server/team/access', async () => {
  const actual = await vi.importActual<typeof TeamAccessModule>('@/server/team/access');
  return {
    ...actual,
    requireMembershipForRestaurant: requireMembershipForRestaurantMock,
  };
});

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

// CSRF failure telemetry writes security events; keep the suite offline.
vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: vi.fn(),
  updateOperatingHours: updateOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: vi.fn(),
  updateServicePeriods: updateServicePeriodsMock,
}));

vi.mock('@/server/ops/zones', () => ({
  createZone: createZoneMock,
  deleteZone: vi.fn(),
  listZones: vi.fn(),
  updateZone: vi.fn(),
}));

vi.mock('@/server/ops/tables', () => ({
  findTableByNumber: vi.fn(),
  insertTable: insertTableMock,
  listTables: vi.fn(),
  listTablesWithSummary: vi.fn(),
}));

vi.mock('@/server/onboarding/readiness', () => ({
  getOnboardingReadiness: getOnboardingReadinessMock,
}));

// Keep the real error classes; stub only the RPC-backed writer.
vi.mock('@/server/onboarding/layout', async () => {
  const actual = await vi.importActual<typeof OnboardingLayoutModule>('@/server/onboarding/layout');
  return { ...actual, replaceOnboardingLayout: replaceOnboardingLayoutMock };
});

// Keep the real error class; stub only the writer.
vi.mock('@/server/onboarding/profile', async () => {
  const actual = await vi.importActual<typeof OnboardingProfileModule>(
    '@/server/onboarding/profile',
  );
  return { ...actual, updateOnboardingProfile: updateOnboardingProfileMock };
});

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import {
  OnboardingLayoutInvalidError,
  OnboardingLayoutLockedError,
  OnboardingLayoutWriteError,
} from '@/server/onboarding/layout';
import { OnboardingSlugTakenError } from '@/server/onboarding/profile';
import { MembershipAccessError } from '@/server/team/access';
import { POST as completePOST } from '@/src/app/api/onboarding/restaurant/[id]/complete/route';
import { PATCH as hoursPATCH } from '@/src/app/api/onboarding/restaurant/[id]/hours/route';
import { PUT as layoutPUT } from '@/src/app/api/onboarding/restaurant/[id]/layout/route';
import { PATCH as profilePATCH } from '@/src/app/api/onboarding/restaurant/[id]/profile/route';
import { PATCH as servicePeriodsPATCH } from '@/src/app/api/onboarding/restaurant/[id]/service-periods/route';
import { POST as tablesPOST } from '@/src/app/api/onboarding/restaurant/[id]/tables/route';
import { POST as zonesPOST } from '@/src/app/api/onboarding/restaurant/[id]/zones/route';

import type * as OnboardingLayoutModule from '@/server/onboarding/layout';
import type * as OnboardingProfileModule from '@/server/onboarding/profile';
import type * as TeamAccessModule from '@/server/team/access';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_A = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_CLIENT = { tag: 'service-role-client' };
const CSRF_TOKEN = 'onboarding-step-csrf-token';

type StepHandler = (
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

type StepDefinition = {
  handler: StepHandler;
  invalidBody: unknown;
  method: 'PATCH' | 'POST' | 'PUT';
  name: string;
  validBody: unknown;
};

const STEPS: StepDefinition[] = [
  {
    name: 'complete',
    method: 'POST',
    handler: completePOST,
    validBody: {},
    invalidBody: null,
  },
  {
    name: 'hours',
    method: 'PATCH',
    handler: hoursPATCH,
    validBody: {
      operatingHours: [{ dayOfWeek: 1, opensAt: '17:00', closesAt: '22:00', isClosed: false }],
    },
    invalidBody: {
      operatingHours: [{ dayOfWeek: 9, opensAt: null, closesAt: null, isClosed: false }],
    },
  },
  {
    name: 'service-periods',
    method: 'PATCH',
    handler: servicePeriodsPATCH,
    validBody: {
      servicePeriods: [
        {
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ],
    },
    invalidBody: {
      servicePeriods: [{ name: '', startTime: '17:00', endTime: '22:00', bookingOption: 'dinner' }],
    },
  },
  {
    name: 'tables',
    method: 'POST',
    handler: tablesPOST,
    validBody: { tables: [{ tableNumber: '1', capacity: 2, zoneId: ZONE_A }] },
    invalidBody: { tables: [{ tableNumber: '1', capacity: 0, zoneId: ZONE_A }] },
  },
  {
    name: 'zones',
    method: 'POST',
    handler: zonesPOST,
    validBody: { zones: [{ name: 'Main Dining' }] },
    invalidBody: { zones: [{ name: '' }] },
  },
  {
    name: 'layout',
    method: 'PUT',
    handler: layoutPUT,
    validBody: {
      zones: [{ name: 'Main Dining' }, { name: 'Terrace' }],
      tables: [
        { tableNumber: 'T1', capacity: 2 },
        { tableNumber: 'T2', capacity: 4, zoneName: 'terrace' },
      ],
    },
    invalidBody: { zones: [], tables: [{ tableNumber: 'T1', capacity: 0 }] },
  },
  {
    name: 'profile',
    method: 'PATCH',
    handler: profilePATCH,
    validBody: { name: 'The Old Crown' },
    invalidBody: { slug: 'My Slug' },
  },
];

const STEP_TABLE = STEPS.map((step) => [step.name, step] as const);
const BODY_PARSING_STEPS = STEP_TABLE.filter(([name]) => name !== 'complete');

function routeContext(id: string = RESTAURANT_ID) {
  return { params: Promise.resolve({ id }) };
}

function csrfHeaders() {
  return {
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  };
}

function stepRequest(
  step: StepDefinition,
  body: unknown,
  options: { includeCsrf?: boolean; restaurantId?: string } = {},
) {
  const { includeCsrf = true, restaurantId = RESTAURANT_ID } = options;
  return new NextRequest(
    `https://app.nabatable.com/api/onboarding/restaurant/${restaurantId}/${step.name}`,
    {
      method: step.method,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: includeCsrf
        ? { 'content-type': 'application/json', ...csrfHeaders() }
        : { 'content-type': 'application/json' },
    },
  );
}

function buildRouteHandlerClient(
  options: {
    user?: { id: string } | null;
    zoneCount?: number;
    zoneRows?: Array<{ id: string; restaurant_id: string }>;
  } = {},
) {
  const {
    user = { id: USER_ID },
    zoneCount = 0,
    zoneRows = [{ id: ZONE_A, restaurant_id: RESTAURANT_ID }],
  } = options;

  const from = vi.fn((table: string) => {
    if (table !== 'zones') {
      throw new Error(`Unexpected table: ${table}`);
    }
    const chain = {
      select: vi.fn(() => chain),
      in: vi.fn(async () => ({ data: zoneRows, error: null })),
      eq: vi.fn(async () => ({ count: zoneCount, error: null })),
    };
    return chain;
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from,
  };
}

function expectNoMutationBoundaryCalls() {
  expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  expect(updateOperatingHoursMock).not.toHaveBeenCalled();
  expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  expect(createZoneMock).not.toHaveBeenCalled();
  expect(insertTableMock).not.toHaveBeenCalled();
  expect(getOnboardingReadinessMock).not.toHaveBeenCalled();
  expect(replaceOnboardingLayoutMock).not.toHaveBeenCalled();
  expect(updateOnboardingProfileMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  getRouteHandlerSupabaseClientMock.mockReset();
  getServiceSupabaseClientMock.mockReset();
  requireMembershipForRestaurantMock.mockReset();
  requireApiRateLimitMock.mockReset();
  updateOperatingHoursMock.mockReset();
  updateServicePeriodsMock.mockReset();
  createZoneMock.mockReset();
  insertTableMock.mockReset();
  getOnboardingReadinessMock.mockReset();
  replaceOnboardingLayoutMock.mockReset();
  updateOnboardingProfileMock.mockReset();

  getRouteHandlerSupabaseClientMock.mockResolvedValue(buildRouteHandlerClient());
  getServiceSupabaseClientMock.mockReturnValue(SERVICE_CLIENT);
  requireMembershipForRestaurantMock.mockResolvedValue({
    restaurant_id: RESTAURANT_ID,
    role: 'owner',
  });
  requireApiRateLimitMock.mockResolvedValue(null);
});

describe('onboarding restaurant step routes shared auth model', () => {
  it.each(STEP_TABLE)(
    'rejects a non-uuid restaurant id on %s before any session work @p1 @api @contract',
    async (_name, step) => {
      const response = await step.handler(
        stepRequest(step, step.validBody, { restaurantId: 'not-a-uuid', includeCsrf: false }),
        routeContext('not-a-uuid'),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid restaurant id',
        code: 'INVALID_RESTAURANT_ID',
      });
      expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
      expectNoMutationBoundaryCalls();
    },
  );

  it.each(STEP_TABLE)(
    'rejects %s without a CSRF token before resolving the session @p1 @api @security',
    async (_name, step) => {
      const response = await step.handler(
        stepRequest(step, step.validBody, { includeCsrf: false }),
        routeContext(),
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('CSRF_INVALID');
      expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
      expectNoMutationBoundaryCalls();
    },
  );

  it.each(STEP_TABLE)(
    'rejects unauthenticated %s requests with the session-expired contract @p1 @api @security',
    async (_name, step) => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(buildRouteHandlerClient({ user: null }));

      const response = await step.handler(stepRequest(step, step.validBody), routeContext());

      expect(response.status).toBe(419);
      await expect(response.json()).resolves.toEqual({
        error: 'Session expired or unavailable',
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Refresh the page and try again.',
      });
      expect(requireMembershipForRestaurantMock).not.toHaveBeenCalled();
      expectNoMutationBoundaryCalls();
    },
  );

  it.each(STEP_TABLE)(
    'rejects cross-tenant %s requests when the caller has no membership @p1 @api @security',
    async (_name, step) => {
      const routeClient = buildRouteHandlerClient();
      getRouteHandlerSupabaseClientMock.mockResolvedValue(routeClient);
      requireMembershipForRestaurantMock.mockRejectedValue(
        new MembershipAccessError({
          status: 403,
          code: 'MEMBERSHIP_NOT_FOUND',
          message: 'Membership not found',
        }),
      );

      const response = await step.handler(stepRequest(step, step.validBody), routeContext());

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: 'You are not a member of this restaurant',
        code: 'FORBIDDEN',
      });
      // Onboarding steps require admin roles and validate membership with the
      // caller's RLS-scoped client.
      expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
        userId: USER_ID,
        restaurantId: RESTAURANT_ID,
        allowedRoles: RESTAURANT_ADMIN_ROLES,
        client: routeClient,
      });
      expectNoMutationBoundaryCalls();
    },
  );

  it.each(STEP_TABLE)(
    'rejects non-admin members on %s before service-role writes @p1 @api @security',
    async (_name, step) => {
      requireMembershipForRestaurantMock.mockRejectedValue(
        new MembershipAccessError({
          status: 403,
          code: 'MEMBERSHIP_ROLE_DENIED',
          message: 'Insufficient permissions for restaurant',
        }),
      );

      const response = await step.handler(stepRequest(step, step.validBody), routeContext());

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: 'You do not have sufficient permissions for this restaurant',
        code: 'FORBIDDEN',
      });
      expectNoMutationBoundaryCalls();
    },
  );
});

describe('onboarding restaurant step routes payload validation', () => {
  it.each(BODY_PARSING_STEPS)(
    'rejects invalid %s payloads after authorization without touching writers @p1 @api @contract',
    async (_name, step) => {
      const response = await step.handler(stepRequest(step, step.invalidBody), routeContext());
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.message).toBe('Some fields need attention.');
      expect(body.error).toBe(body.message);
      expect(Object.keys(body.fields ?? {}).length).toBeGreaterThan(0);
      expectNoMutationBoundaryCalls();
    },
  );

  it('rejects malformed JSON bodies on hours @p2 @api @contract', async () => {
    const step = STEPS[1];

    const response = await step.handler(stepRequest(step, '{not-json'), routeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'The request body is not valid JSON.',
      code: 'INVALID_JSON',
      message: 'The request body is not valid JSON.',
    });
    expectNoMutationBoundaryCalls();
  });

  it('rejects overlapping and inverted service periods with 400 field paths, not 500 @p1 @api @contract', async () => {
    const step = STEPS[2];

    const response = await step.handler(
      stepRequest(step, {
        servicePeriods: [
          {
            name: 'Lunch',
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '15:00',
            bookingOption: 'lunch',
          },
          {
            name: 'Dinner',
            dayOfWeek: 1,
            startTime: '14:00',
            endTime: '22:00',
            bookingOption: 'dinner',
          },
          {
            name: 'Late',
            dayOfWeek: 2,
            startTime: '23:00',
            endTime: '22:00',
            bookingOption: 'dinner',
          },
        ],
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields).toEqual({
      'servicePeriods.1.startTime': ['Overlaps "Lunch" on the same day. Adjust the times.'],
      'servicePeriods.2.endTime': ['End time must be after the start time.'],
    });
    expectNoMutationBoundaryCalls();
  });

  it('rejects open days without distinct opening and closing times with 400 field paths @p1 @api @contract', async () => {
    const step = STEPS[1];

    const response = await step.handler(
      stepRequest(step, {
        operatingHours: [
          { dayOfWeek: 1, opensAt: '09:00', closesAt: '09:00', isClosed: false },
          { dayOfWeek: 2, opensAt: null, closesAt: '22:00', isClosed: false },
          { dayOfWeek: 3, opensAt: null, closesAt: null, isClosed: true },
          { dayOfWeek: 3, opensAt: null, closesAt: null, isClosed: true },
        ],
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields).toEqual({
      'operatingHours.0.closesAt': ['Closing time must differ from the opening time.'],
      'operatingHours.1.opensAt': ['Enter a time like 09:00.'],
      'operatingHours.3.dayOfWeek': ['Each day can only appear once.'],
    });
    expectNoMutationBoundaryCalls();
  });

  it('rejects onboarding tables that omit a zone reference @p2 @api @contract', async () => {
    const step = STEPS[3];

    const response = await step.handler(
      stepRequest(step, { tables: [{ tableNumber: '1', capacity: 2 }] }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Each onboarding table must reference a zone',
      code: 'TABLE_ZONE_REQUIRED',
      message: 'Each onboarding table must reference a zone',
    });
    expect(insertTableMock).not.toHaveBeenCalled();
  });
});

describe('onboarding profile update route', () => {
  const step = () => STEPS.find((entry) => entry.name === 'profile') as StepDefinition;
  const SAVED = { id: RESTAURANT_ID, name: 'The Old Crown', slug: 'old-crown', timezone: 'Europe/London' };

  it('updates only the fields sent and returns the canonical basics @p1 @api', async () => {
    updateOnboardingProfileMock.mockResolvedValue(SAVED);

    const response = await profilePATCH(
      stepRequest(step(), { name: 'The Old Crown', timezone: 'europe/london' }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ restaurant: SAVED });
    expect(updateOnboardingProfileMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      { name: 'The Old Crown', timezone: 'Europe/London' },
      SERVICE_CLIENT,
    );
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'onboarding:profile', tenantId: RESTAURANT_ID }),
    );
  });

  it('maps a slug clash to 409 SLUG_TAKEN on the slug field @p1 @api @contract', async () => {
    updateOnboardingProfileMock.mockRejectedValue(new OnboardingSlugTakenError());

    const response = await profilePATCH(stepRequest(step(), { slug: 'taken' }), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SLUG_TAKEN');
    expect(body.fields).toEqual({ slug: ['That web address is taken. Try a different slug.'] });
  });

  it('returns C1 field errors for a malformed slug and an invalid timezone @p1 @api @contract', async () => {
    const slugResponse = await profilePATCH(
      stepRequest(step(), { slug: 'My Slug!' }),
      routeContext(),
    );
    const slugBody = await slugResponse.json();
    expect(slugResponse.status).toBe(400);
    expect(slugBody.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(slugBody.fields)).toEqual(['slug']);

    const tzResponse = await profilePATCH(
      stepRequest(step(), { timezone: 'Mars/Olympus' }),
      routeContext(),
    );
    const tzBody = await tzResponse.json();
    expect(tzResponse.status).toBe(400);
    expect(tzBody.fields).toEqual({ timezone: ['Choose a valid timezone.'] });
    expect(updateOnboardingProfileMock).not.toHaveBeenCalled();
  });

  it('refuses an empty patch and unknown fields @p2 @api', async () => {
    const empty = await profilePATCH(stepRequest(step(), {}), routeContext());
    expect(empty.status).toBe(400);
    const unknown = await profilePATCH(stepRequest(step(), { isActive: false }), routeContext());
    expect(unknown.status).toBe(400);
    expect(updateOnboardingProfileMock).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without database text @p1 @api @security', async () => {
    updateOnboardingProfileMock.mockRejectedValue(
      new Error('Failed to update restaurant: permission denied for table restaurants'),
    );

    const response = await profilePATCH(stepRequest(step(), { name: 'X' }), routeContext());
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('permission denied');
  });
});

describe('onboarding restaurant step routes happy paths', () => {
  it('confirms launch readiness when hours, service periods and tables exist @p1 @api', async () => {
    getOnboardingReadinessMock.mockResolvedValue({ ready: true, missing: [] });

    const response = await completePOST(stepRequest(STEPS[0], {}), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      ready: true,
      restaurantId: RESTAURANT_ID,
    });
    expect(getOnboardingReadinessMock).toHaveBeenCalledWith(SERVICE_CLIENT, RESTAURANT_ID);
  });

  it('is idempotent: repeated launch checks give the same answer without writing @p1 @api', async () => {
    getOnboardingReadinessMock.mockResolvedValue({ ready: true, missing: [] });

    const first = await completePOST(stepRequest(STEPS[0], {}), routeContext());
    const second = await completePOST(stepRequest(STEPS[0], {}), routeContext());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
    expect(replaceOnboardingLayoutMock).not.toHaveBeenCalled();
  });

  it('refuses launch with 409 ONBOARDING_INCOMPLETE listing what is missing @p1 @api @contract', async () => {
    getOnboardingReadinessMock.mockResolvedValue({
      ready: false,
      missing: ['service_periods', 'tables'],
    });

    const response = await completePOST(stepRequest(STEPS[0], {}), routeContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Finish the remaining setup steps before launching.',
      code: 'ONBOARDING_INCOMPLETE',
      message: 'Finish the remaining setup steps before launching.',
      details: { missing: ['service_periods', 'tables'] },
    });
  });

  it('returns a generic 500 without database text when the readiness read fails @p1 @api @security', async () => {
    getOnboardingReadinessMock.mockRejectedValue(
      new Error('relation "restaurant_service_periods" does not exist'),
    );

    const response = await completePOST(stepRequest(STEPS[0], {}), routeContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('relation');
  });

  it('replaces the zones and tables layout in one call @p1 @api', async () => {
    const layout = {
      zones: [{ id: ZONE_A, name: 'Main Dining', sortOrder: 0, active: true }],
      tables: [],
    };
    replaceOnboardingLayoutMock.mockResolvedValue(layout);

    const response = await layoutPUT(stepRequest(STEPS[5], STEPS[5].validBody), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: layout });
    expect(replaceOnboardingLayoutMock).toHaveBeenCalledTimes(1);
    expect(replaceOnboardingLayoutMock).toHaveBeenCalledWith(SERVICE_CLIENT, RESTAURANT_ID, {
      zones: [{ name: 'Main Dining' }, { name: 'Terrace' }],
      tables: [
        { tableNumber: 'T1', capacity: 2 },
        { tableNumber: 'T2', capacity: 4, zoneName: 'terrace' },
      ],
    });
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'onboarding:layout', tenantId: RESTAURANT_ID }),
    );
  });

  it('rejects duplicate table numbers, duplicate zones and unknown zone names before the RPC @p1 @api @contract', async () => {
    const response = await layoutPUT(
      stepRequest(STEPS[5], {
        zones: [{ name: 'Bar' }, { name: 'bar' }],
        tables: [
          { tableNumber: 'T1', capacity: 2 },
          { tableNumber: 'T1', capacity: 2, zoneName: 'Garden' },
        ],
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields).toMatchObject({
      'zones.1.name': ['Zone names must be unique'],
      'tables.1.tableNumber': ['Table numbers must be unique'],
      'tables.1.zoneName': ['Choose one of the zones above'],
    });
    expect(replaceOnboardingLayoutMock).not.toHaveBeenCalled();
  });

  it('maps a locked layout (restaurant has bookings) to 409 ONBOARDING_LAYOUT_LOCKED @p1 @api @contract', async () => {
    replaceOnboardingLayoutMock.mockRejectedValue(new OnboardingLayoutLockedError());

    const response = await layoutPUT(stepRequest(STEPS[5], STEPS[5].validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('ONBOARDING_LAYOUT_LOCKED');
  });

  it('maps a database payload rejection to 400 and hides the reason @p2 @api', async () => {
    replaceOnboardingLayoutMock.mockRejectedValue(
      new OnboardingLayoutInvalidError('zone names must be unique'),
    );

    const response = await layoutPUT(stepRequest(STEPS[5], STEPS[5].validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('ONBOARDING_LAYOUT_INVALID');
  });

  it('returns a generic 500 for unexpected layout write failures @p1 @api @security', async () => {
    replaceOnboardingLayoutMock.mockRejectedValue(new OnboardingLayoutWriteError('XX000'));

    const response = await layoutPUT(stepRequest(STEPS[5], STEPS[5].validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('never returns raw database text from step writers @p1 @api @security', async () => {
    updateOperatingHoursMock.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "secret_idx"'),
    );

    const response = await hoursPATCH(stepRequest(STEPS[1], STEPS[1].validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret_idx');
  });

  it('saves operating hours through the service-role client @p1 @api', async () => {
    const snapshot = {
      weekly: [{ dayOfWeek: 1, opensAt: '17:00', closesAt: '22:00', isClosed: false }],
      overrides: [],
    };
    updateOperatingHoursMock.mockResolvedValue(snapshot);

    const response = await hoursPATCH(stepRequest(STEPS[1], STEPS[1].validBody), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ operatingHours: snapshot });
    expect(updateOperatingHoursMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      {
        weekly: [{ dayOfWeek: 1, opensAt: '17:00', closesAt: '22:00', isClosed: false }],
        overrides: [],
      },
      SERVICE_CLIENT,
    );
  });

  it('saves service periods through the service-role client @p1 @api', async () => {
    const saved = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ];
    updateServicePeriodsMock.mockResolvedValue(saved);

    const response = await servicePeriodsPATCH(
      stepRequest(STEPS[2], STEPS[2].validBody),
      routeContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ servicePeriods: saved });
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'onboarding:service-periods',
        tenantId: RESTAURANT_ID,
        userId: USER_ID,
      }),
    );
    expect(updateServicePeriodsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      [
        {
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ],
      SERVICE_CLIENT,
    );
  });

  it('creates onboarding tables after verifying zone ownership with the RLS client @p1 @api', async () => {
    const created = {
      id: '66666666-6666-4666-8666-666666666666',
      table_number: '1',
      capacity: 2,
      zone_id: ZONE_A,
    };
    insertTableMock.mockResolvedValue(created);

    const response = await tablesPOST(stepRequest(STEPS[3], STEPS[3].validBody), routeContext());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ tables: [created] });
    expect(insertTableMock).toHaveBeenCalledWith(SERVICE_CLIENT, {
      restaurant_id: RESTAURANT_ID,
      table_number: '1',
      capacity: 2,
      zone_id: ZONE_A,
      category: 'dining',
      seating_type: 'standard',
      mobility: 'fixed',
      status: 'available',
    });
  });

  it('creates onboarding zones through the service-role client @p1 @api', async () => {
    const created = {
      id: ZONE_A,
      restaurant_id: RESTAURANT_ID,
      name: 'Main Dining',
      sort_order: 0,
      active: true,
    };
    createZoneMock.mockResolvedValue(created);

    const response = await zonesPOST(stepRequest(STEPS[4], STEPS[4].validBody), routeContext());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ zones: [created] });
    expect(createZoneMock).toHaveBeenCalledWith(SERVICE_CLIENT, {
      restaurantId: RESTAURANT_ID,
      name: 'Main Dining',
      sortOrder: 0,
      active: true,
    });
  });
});
