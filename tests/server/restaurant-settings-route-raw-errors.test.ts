import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.hoisted(() => vi.fn());
const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const updateRestaurantMock = vi.hoisted(() => vi.fn());
const deleteRestaurantMock = vi.hoisted(() => vi.fn());
const ensureTemplateWriteAccessMock = vi.hoisted(() => vi.fn());
const templateResolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const resolveTemplateKeyParamMock = vi.hoisted(() => vi.fn());
const upsertRestaurantEmailTemplateMock = vi.hoisted(() => vi.fn());
const resetRestaurantEmailTemplateMock = vi.hoisted(() => vi.fn());
const getOperatingHoursMock = vi.hoisted(() => vi.fn());
const getServicePeriodsMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());
const linkLocationMock = vi.hoisted(() => vi.fn());
const syncBusinessInfoMock = vi.hoisted(() => vi.fn());
const disconnectConnectionMock = vi.hoisted(() => vi.fn());
const createAuthorizationMock = vi.hoisted(() => vi.fn());
const verifyUserPasswordConfirmationMock = vi.hoisted(() => vi.fn());
const requireProviderRefreshBudgetMock = vi.hoisted(() => vi.fn());
const businessContextErrors = vi.hoisted(() => {
  class BusinessContextValidationError extends Error {
    readonly field: string;
    constructor(field: string, message: string) {
      super(message);
      this.name = 'BusinessContextValidationError';
      this.field = field;
    }
  }
  class BusinessContextStaleWriteError extends Error {
    readonly currentRevision: number;
    constructor(currentRevision: number) {
      super('Business context changed since it was loaded.');
      this.name = 'BusinessContextStaleWriteError';
      this.currentRevision = currentRevision;
    }
  }
  return { BusinessContextValidationError, BusinessContextStaleWriteError };
});
const PasswordConfirmationErrorMock = vi.hoisted(
  () =>
    class PasswordConfirmationError extends Error {
      code = 'PASSWORD_CONFIRMATION_FAILED';
      status = 403;
    },
);

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: vi.fn(),
  captureRestaurantServerEvent: vi.fn(),
}));

vi.mock('@/server/dual-sync/retention/telemetry', () => ({
  captureSafeGbpException: vi.fn(),
}));

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/src/app/api/ops/restaurants/[id]/email-templates/_shared', () => ({
  buildTemplateDto: vi.fn(),
  ensureTemplateWriteAccess: ensureTemplateWriteAccessMock,
  resolveRestaurantId: templateResolveRestaurantIdMock,
  resolveTemplateKeyParam: resolveTemplateKeyParamMock,
}));

vi.mock('@/server/restaurants/businessContext', () => ({
  BusinessContextValidationError: businessContextErrors.BusinessContextValidationError,
  BusinessContextStaleWriteError: businessContextErrors.BusinessContextStaleWriteError,
  getRestaurantBusinessContext: getRestaurantBusinessContextMock,
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

vi.mock('@/server/restaurants', () => ({
  deleteRestaurant: deleteRestaurantMock,
  updateRestaurantProfile: updateRestaurantMock,
}));

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantBusinessDescription: vi.fn(),
  upsertRestaurantBusinessDescription: vi.fn(),
}));

vi.mock('@/server/restaurants/emailTemplates', () => ({
  upsertRestaurantEmailTemplate: upsertRestaurantEmailTemplateMock,
  resetRestaurantEmailTemplate: resetRestaurantEmailTemplateMock,
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: getOperatingHoursMock,
  updateOperatingHours: vi.fn(),
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: getServicePeriodsMock,
  updateServicePeriods: vi.fn(),
}));

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
  replaceRestaurantTurnBands: vi.fn(),
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: vi.fn(),
}));

vi.mock('@/server/google-business-profile/service', () => ({
  createGoogleBusinessProfileAuthorization: createAuthorizationMock,
  disconnectGoogleBusinessProfileConnection: disconnectConnectionMock,
  getGoogleBusinessProfileConnectionState: vi.fn(),
  linkGoogleBusinessProfileLocation: linkLocationMock,
  syncGoogleBusinessProfileBusinessInformation: syncBusinessInfoMock,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile: vi.fn(),
  syncRestaurantServicePeriodsWithGoogleBusinessProfile: vi.fn(),
}));

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: PasswordConfirmationErrorMock,
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));

vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));

vi.mock('@/server/dual-sync/freshness/operator-connection-state', () => ({
  loadGbpOperatorConnectionState: vi.fn(),
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: unknown, handler: () => Promise<Response>) => handler()),
}));

import { INTERNAL_ERROR_MESSAGE } from '@/lib/api/errors';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  GET as getBusinessContext,
  PUT as putBusinessContext,
} from '@/src/app/api/ops/restaurants/[id]/business-context/route';
import {
  DELETE as deleteTemplate,
  PATCH as patchTemplate,
} from '@/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/route';
import { POST as connectPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/connect/route';
import {
  DELETE as gbpDELETE,
  POST as gbpPOST,
  PUT as gbpPUT,
} from '@/src/app/api/ops/restaurants/[id]/google-business-profile/route';
import { GET as getHours } from '@/src/app/api/ops/restaurants/[id]/hours/route';
import {
  DELETE as deleteRestaurantRoute,
  PATCH as patchRestaurant,
} from '@/src/app/api/ops/restaurants/[id]/route';
import { GET as getServicePeriodsRoute } from '@/src/app/api/ops/restaurants/[id]/service-periods/route';
import { GET as getTurnBands } from '@/src/app/api/ops/restaurants/[id]/turn-bands/route';

import type * as LoggerModule from '@/lib/logger';

const RESTAURANT_ID = 'rest-1';
const SENTINEL = 'SECRET_DB_DETAIL';
const STAFF_EMAIL = 'owner@example.com';

function secretError() {
  return new Error(
    `${SENTINEL} duplicate key value violates constraint for ${STAFF_EMAIL} +44 7700 900123`,
  );
}

function routeContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID }) };
}

function templateRouteContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID, templateKey: 'confirmation' }) };
}

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest(`https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectSafeFailure(
  response: Response,
  expected: { status: number; route: string },
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(expected.status);
  const text = await response.text();
  expect(text).not.toContain(SENTINEL);
  expect(text).not.toContain(STAFF_EMAIL);
  const body = JSON.parse(text) as Record<string, unknown>;
  expect(typeof body.code).toBe('string');

  expect(loggerErrorMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ route: expected.route, restaurantId: RESTAURANT_ID }),
  );
  const logged = JSON.stringify(loggerErrorMock.mock.calls);
  expect(logged).not.toContain(SENTINEL);
  expect(logged).not.toContain(STAFF_EMAIL);
  expect(logged).not.toContain('7700 900123');
  return body;
}

/**
 * A known failure mapped to a fixed C1 code (4xx): the body never carries the raw exception text,
 * and nothing that was logged carries staff PII.
 */
async function expectSafeKnownFailure(
  response: Response,
  expected: { status: number; code: string },
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(expected.status);
  const text = await response.text();
  expect(text).not.toContain(SENTINEL);
  expect(text).not.toContain(STAFF_EMAIL);
  const body = JSON.parse(text) as Record<string, unknown>;
  expect(body.code).toBe(expected.code);
  expect(typeof body.message).toBe('string');
  expect(body.error).toBe(body.message);
  const logged = JSON.stringify(loggerErrorMock.mock.calls);
  expect(logged).not.toContain(STAFF_EMAIL);
  expect(logged).not.toContain('7700 900123');
  return body;
}

/**
 * Routes migrated to C1 (`internalError`) log a sanitized error message server-side (PII
 * redacted by lib/logger) and never return it. The client body is the fixed C1 shape.
 */
async function expectC1InternalFailure(
  response: Response,
  expected: { route: string; message: string },
): Promise<void> {
  expect(response.status).toBe(500);
  const text = await response.text();
  expect(text).not.toContain(SENTINEL);
  expect(text).not.toContain(STAFF_EMAIL);
  expect(JSON.parse(text)).toEqual({
    error: expected.message,
    message: expected.message,
    code: 'INTERNAL_ERROR',
  });
  expect(loggerErrorMock).toHaveBeenCalledWith(
    'api.internal_error',
    expect.objectContaining({ route: expected.route, restaurantId: RESTAURANT_ID }),
  );
  const logged = JSON.stringify(loggerErrorMock.mock.calls);
  expect(logged).not.toContain(STAFF_EMAIL);
  expect(logged).not.toContain('7700 900123');
}

/** GBP routes: internalError with the route's own fallback copy; the body is fixed. */
async function expectGbpInternalFailure(response: Response): Promise<void> {
  expect(response.status).toBe(500);
  const text = await response.text();
  expect(text).not.toContain(SENTINEL);
  expect(text).not.toContain(STAFF_EMAIL);
  const body = JSON.parse(text) as Record<string, unknown>;
  expect(body.code).toBe('INTERNAL_ERROR');
  expect(Object.keys(body).sort()).toEqual(['code', 'error', 'message']);
  expect(loggerErrorMock).toHaveBeenCalledWith(
    'api.internal_error',
    expect.objectContaining({
      route: 'ops.restaurants.google-business-profile',
      restaurantId: RESTAURANT_ID,
    }),
  );
  const logged = JSON.stringify(loggerErrorMock.mock.calls);
  expect(logged).not.toContain(STAFF_EMAIL);
  expect(logged).not.toContain('7700 900123');
}

describe('restaurant settings routes never echo raw exception text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRestaurantIdMock.mockResolvedValue(RESTAURANT_ID);
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1', userEmail: STAFF_EMAIL });
    templateResolveRestaurantIdMock.mockResolvedValue(RESTAURANT_ID);
    resolveTemplateKeyParamMock.mockResolvedValue('confirmation');
    ensureTemplateWriteAccessMock.mockResolvedValue({ id: RESTAURANT_ID });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: STAFF_EMAIL } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReturnValue({ service: true });
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'owner' });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    requireProviderRefreshBudgetMock.mockResolvedValue(null);
  });

  it('business-context GET returns a fixed 500 and logs without the raw message', async () => {
    getRestaurantBusinessContextMock.mockRejectedValue(secretError());

    const response = await getBusinessContext(jsonRequest('GET'), routeContext());

    await expectC1InternalFailure(response, {
      route: 'ops.restaurants.business-context',
      message: 'Unable to load restaurant business context.',
    });
  });

  it('business-context PUT returns a fixed 500 with a stable code for unexpected failures', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue(secretError());

    const response = await putBusinessContext(jsonRequest('PUT', { links: [] }), routeContext());

    await expectC1InternalFailure(response, {
      route: 'ops.restaurants.business-context',
      message: 'Unable to update restaurant business context.',
    });
  });

  it('business-context PUT maps domain validation to a 400 with field errors', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue(
      new businessContextErrors.BusinessContextValidationError(
        'links.0.url',
        'Enter a full web address.',
      ),
    );

    const response = await putBusinessContext(jsonRequest('PUT', { links: [] }), routeContext());

    const body = await expectSafeKnownFailure(response, {
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(body.fields).toEqual({ 'links.0.url': ['Enter a full web address.'] });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('business-context PUT maps a stale revision to 409 STALE_WRITE', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue(
      new businessContextErrors.BusinessContextStaleWriteError(7),
    );

    const response = await putBusinessContext(
      jsonRequest('PUT', { links: [], expectedRevision: 6 }),
      routeContext(),
    );

    const body = await expectSafeKnownFailure(response, { status: 409, code: 'STALE_WRITE' });
    expect(body.details).toEqual({ currentRevision: 7 });
  });

  it('business-context PUT returns C1 field errors for invalid payloads', async () => {
    const response = await putBusinessContext(jsonRequest('PUT', {}), routeContext());

    const body = await expectSafeKnownFailure(response, {
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(body.fields).toEqual({
      _root: ['At least one business-context family must be provided.'],
    });
    expect(updateRestaurantBusinessContextMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('restaurant PATCH returns a fixed 500 when the update throws', async () => {
    updateRestaurantMock.mockRejectedValue(secretError());

    const response = await patchRestaurant(
      jsonRequest('PATCH', { name: 'The Bell' }),
      routeContext(),
    );

    await expectC1InternalFailure(response, {
      route: 'ops.restaurants.profile',
      message: 'Something went wrong saving these settings.',
    });
  });

  it('restaurant DELETE returns a fixed 500 when deletion throws', async () => {
    deleteRestaurantMock.mockRejectedValue(secretError());

    const response = await deleteRestaurantRoute(jsonRequest('DELETE'), routeContext());

    await expectC1InternalFailure(response, {
      route: 'ops.restaurants.profile',
      message: 'Unable to delete restaurant.',
    });
  });

  it('email-template PATCH returns a fixed 500 when saving throws', async () => {
    upsertRestaurantEmailTemplateMock.mockRejectedValue(secretError());

    const response = await patchTemplate(
      jsonRequest('PATCH', {
        variants: [
          {
            id: 'variant-1',
            name: 'Only variant',
            subject: 'Hello - {{venue}}',
            preheader: 'World',
            headline: 'Hello',
            intro: 'World',
            cue: '',
            ask: '',
            ctaLabel: 'Open',
            isActive: true,
            order: 0,
          },
        ],
      }),
      templateRouteContext(),
    );

    const body = await expectSafeFailure(response, {
      status: 500,
      route: 'ops.restaurants.email-templates',
    });
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('email-template DELETE returns a fixed 500 when reset throws', async () => {
    resetRestaurantEmailTemplateMock.mockRejectedValue(secretError());

    const response = await deleteTemplate(jsonRequest('DELETE'), templateRouteContext());

    const body = await expectSafeFailure(response, {
      status: 500,
      route: 'ops.restaurants.email-templates',
    });
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it.each([
    ['hours', () => getOperatingHoursMock, getHours, 'ops.restaurants.hours'],
    [
      'service-periods',
      () => getServicePeriodsMock,
      getServicePeriodsRoute,
      'ops.restaurants.service-periods',
    ],
    ['turn-bands', () => getRestaurantTurnBandsMock, getTurnBands, 'ops.restaurants.turn-bands'],
  ] as const)(
    '%s GET returns a fixed 500 when the read fails',
    async (_name, getMock, handler, route) => {
      getMock().mockRejectedValue(secretError());
      getServicePeriodsMock.mockRejectedValue(secretError());

      const response = await handler(jsonRequest('GET'), routeContext());

      // A failed read is not a caller mistake: C1 internalError, no raw text in the body.
      await expectC1InternalFailure(response, {
        route,
        message: INTERNAL_ERROR_MESSAGE,
      });
    },
  );

  it('GBP link keeps a 404 for an unavailable location without echoing the message', async () => {
    linkLocationMock.mockRejectedValue(
      new GoogleBusinessProfileError(`${SENTINEL} The selected location is no longer available.`, {
        code: 'GBP_LOCATION_NOT_FOUND',
        status: 404,
      }),
    );

    const response = await gbpPUT(
      jsonRequest('PUT', {
        accountName: 'accounts/1',
        accountId: '1',
        locationName: 'locations/2',
        locationId: '2',
      }),
      routeContext(),
    );

    await expectSafeKnownFailure(response, { status: 404, code: 'GBP_LOCATION_NOT_FOUND' });
  });

  it('GBP link does not classify an untyped error by its message', async () => {
    linkLocationMock.mockRejectedValue(
      new Error(`${SENTINEL} The selected location is no longer available for ${STAFF_EMAIL}.`),
    );

    const response = await gbpPUT(
      jsonRequest('PUT', {
        accountName: 'accounts/1',
        accountId: '1',
        locationName: 'locations/2',
        locationId: '2',
      }),
      routeContext(),
    );

    // Untyped errors fall through to internalError: fixed body, no PII in the body or logs.
    await expectGbpInternalFailure(response);
  });

  it('GBP link returns a fixed 500 for unexpected failures', async () => {
    linkLocationMock.mockRejectedValue(secretError());

    const response = await gbpPUT(
      jsonRequest('PUT', {
        accountName: 'accounts/1',
        accountId: '1',
        locationName: 'locations/2',
        locationId: '2',
      }),
      routeContext(),
    );

    await expectGbpInternalFailure(response);
  });

  it.each([
    ['GBP_LOCATION_NOT_LINKED', 409],
    ['GBP_REAUTH_REQUIRED', 409],
  ] as const)('GBP sync maps a typed %s error by code', async (code, status) => {
    syncBusinessInfoMock.mockRejectedValue(
      new GoogleBusinessProfileError(`${SENTINEL} ${STAFF_EMAIL}`, { code, status }),
    );

    const response = await gbpPOST(jsonRequest('POST', { password: 'pw' }), routeContext());

    await expectSafeKnownFailure(response, { status, code });
  });

  it('GBP sync returns a fixed 500 for unexpected failures', async () => {
    syncBusinessInfoMock.mockRejectedValue(new Error(`${SENTINEL} ${STAFF_EMAIL}`));

    const response = await gbpPOST(jsonRequest('POST', { password: 'pw' }), routeContext());

    await expectGbpInternalFailure(response);
  });

  it('GBP sync still returns password confirmation errors unchanged', async () => {
    verifyUserPasswordConfirmationMock.mockRejectedValue(
      new PasswordConfirmationErrorMock('Password confirmation failed.'),
    );

    const response = await gbpPOST(jsonRequest('POST', { password: 'pw' }), routeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: 'Password confirmation failed.',
      error: 'Password confirmation failed.',
      code: 'PASSWORD_CONFIRMATION_FAILED',
    });
  });

  it('GBP disconnect returns a fixed 500 for unexpected failures', async () => {
    disconnectConnectionMock.mockRejectedValue(secretError());

    const response = await gbpDELETE(jsonRequest('DELETE', { password: 'pw' }), routeContext());

    await expectGbpInternalFailure(response);
  });

  it('GBP connect returns a fixed 500 when authorization cannot start', async () => {
    createAuthorizationMock.mockRejectedValue(secretError());

    const response = await connectPOST(jsonRequest('POST'), routeContext());

    const body = await expectSafeFailure(response, {
      status: 500,
      route: 'ops.restaurants.google-business-profile.connect',
    });
    expect(body.code).toBe('GBP_AUTHORIZATION_START_FAILED');
  });

  it('passes admin-access responses through untouched', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await gbpDELETE(jsonRequest('DELETE', { password: 'pw' }), routeContext());

    expect(response.status).toBe(403);
    expect(disconnectConnectionMock).not.toHaveBeenCalled();
  });
});
