import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const createZoneMock = vi.hoisted(() => vi.fn());
const insertTableMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

// Keep the real guard chain (withRestaurantAuthorization -> requireSession ->
// requireRestaurantMember) and stub only the membership lookup underneath it,
// so the shared onboarding auth model is exercised end-to-end.
vi.mock('@/server/team/access', async () => {
  const actual = await vi.importActual<typeof import('@/server/team/access')>(
    '@/server/team/access',
  );
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

import { MembershipAccessError } from '@/server/team/access';
import { POST as completePOST } from '@/src/app/api/onboarding/restaurant/[id]/complete/route';
import { PATCH as hoursPATCH } from '@/src/app/api/onboarding/restaurant/[id]/hours/route';
import { PATCH as servicePeriodsPATCH } from '@/src/app/api/onboarding/restaurant/[id]/service-periods/route';
import { POST as tablesPOST } from '@/src/app/api/onboarding/restaurant/[id]/tables/route';
import { POST as zonesPOST } from '@/src/app/api/onboarding/restaurant/[id]/zones/route';

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
  method: 'PATCH' | 'POST';
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
      expect(body.message).toBe('Validation failed');
      expect(body.details).toBeDefined();
      expectNoMutationBoundaryCalls();
    },
  );

  it('rejects malformed JSON bodies on hours @p2 @api @contract', async () => {
    const step = STEPS[1];

    const response = await step.handler(stepRequest(step, '{not-json'), routeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Invalid request body' });
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
      message: 'Each onboarding table must reference a zone',
    });
    expect(insertTableMock).not.toHaveBeenCalled();
  });
});

describe('onboarding restaurant step routes happy paths', () => {
  it('acknowledges completion for admins without touching service clients @p1 @api', async () => {
    const response = await completePOST(stepRequest(STEPS[0], {}), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      restaurantId: RESTAURANT_ID,
    });
    expectNoMutationBoundaryCalls();
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
