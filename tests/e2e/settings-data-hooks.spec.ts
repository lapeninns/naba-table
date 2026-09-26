import { expect, test } from '@playwright/test';

import type { BrowserContext, Page, Route } from '@playwright/test';

/**
 * Opt-in browser proof for the restaurant settings data hooks.
 *
 *   QA_DATA_HOOKS=1 QA_DATA_HOOKS_BASE_URL=http://app.localhost:5182 \
 *     QA_DATA_HOOKS_SHOTS=/abs/dir \
 *     pnpm exec playwright test -c tests/e2e/settings-data-hooks.playwright.config.ts
 *
 * Skipped unless QA_DATA_HOOKS=1. Refuses to run against anything but a local host, aborts every
 * request to another host, and answers every `/api/ops/**` call from stateful in-memory fixtures
 * (a PUT changes what later GETs return). No write ever reaches a network.
 */

const ALLOWED_HOSTS = new Set(['localhost', 'app.localhost', '127.0.0.1']);
const QA_AUTH_COOKIE = { name: '__nabatable_qa_ops_auth', value: 'enabled' };
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BASE = `/api/ops/restaurants/${RESTAURANT_ID}`;
const STAMP = '2026-05-16T09:00:00.000Z';
/** A server error body that must never reach the DOM. */
const SERVER_SENTINEL = 'relation "qa_sentinel_internal" does not exist';

function resolveBaseUrl(configured: string | undefined): string {
  const baseUrl = process.env.QA_DATA_HOOKS_BASE_URL ?? configured ?? 'http://app.localhost:5182';
  const host = new URL(baseUrl).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `settings-data-hooks refuses to run against "${host}": only localhost, app.localhost or 127.0.0.1`,
    );
  }
  return baseUrl;
}

// ---------------------------------------------------------------------------
// Stateful fixtures
// ---------------------------------------------------------------------------

type WeeklyRow = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes: number | null;
  reservationSlotTimes: string[] | null;
};
type HoursSnapshot = { updatedAt?: string; weekly: WeeklyRow[]; overrides: unknown[] };
type PeriodRow = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: string;
  updatedAt?: string | null;
};
type Category = {
  id: string;
  displayName: string;
  categoryCode: string | null;
  moreHoursTypes: unknown[];
  isPrimary: boolean;
  source: string;
  managedBy: string;
  updatedAt: string | null;
};
type ContextFamily = {
  businessDetails: Record<string, unknown> | null;
  links: unknown[];
  categories: Category[];
  serviceAreas: unknown[];
  attributes: unknown[];
  serviceItems: unknown[];
};

type FailureSpec = { status: number; body: Record<string, unknown> };
type LoggedRequest = { method: string; path: string };

type FixtureState = {
  hours: HoursSnapshot;
  periods: PeriodRow[];
  core: ContextFamily;
  google: ContextFamily;
};

function category(id: string, displayName: string, isPrimary: boolean, source: string): Category {
  return {
    id,
    displayName,
    categoryCode: `gcid:${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    moreHoursTypes: [],
    isPrimary,
    source,
    managedBy: source === 'gbp' ? 'gbp' : 'nabatable',
    updatedAt: STAMP,
  };
}

function contextFamily(categories: Category[]): ContextFamily {
  return {
    businessDetails: {
      id: 'qa-business-details',
      openingDate: null,
      businessStatus: 'OPEN',
      isServiceAreaBusiness: false,
      source: 'core',
      managedBy: 'nabatable',
      updatedAt: STAMP,
    },
    links: [],
    categories,
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
  };
}

function initialState(): FixtureState {
  return {
    hours: {
      updatedAt: STAMP,
      weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        opensAt: '12:00',
        closesAt: '22:00',
        isClosed: false,
        notes: null,
        reservationIntervalMinutes: 15,
        reservationSlotTimes: null,
      })),
      overrides: [],
    },
    periods: Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
      {
        id: `lunch-${dayOfWeek}`,
        name: 'Lunch',
        dayOfWeek,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
        updatedAt: null,
      },
      {
        id: `dinner-${dayOfWeek}`,
        name: 'Dinner',
        dayOfWeek,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
        updatedAt: null,
      },
    ]),
    core: contextFamily([category('cat-restaurant', 'Restaurant', true, 'core')]),
    google: contextFamily([
      category('gbp-restaurant', 'Restaurant', true, 'gbp'),
      category('gbp-gastropub', 'Gastropub', false, 'gbp'),
    ]),
  };
}

const restaurant = {
  id: RESTAURANT_ID,
  name: 'QA Data Hooks Restaurant',
  slug: 'qa-data-hooks',
  isActive: true,
  timezone: 'Europe/London',
  capacity: 48,
  contactEmail: 'qa.ops@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  businessDescription: 'Local QA fixture restaurant for settings data-hook proof.',
  managerDailySummaryEnabled: true,
  managerWhatsappEnabled: false,
  managerName: 'QA',
  managerNotificationPhone: '+440000000001',
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: 'QA browser fixtures only.',
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

const occasions = [
  {
    key: 'lunch',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'Lunch bookings',
    sortOrder: 1,
    defaultStartTime: '12:00',
    defaultEndTime: '15:00',
    isActive: true,
  },
  {
    key: 'dinner',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'Dinner bookings',
    sortOrder: 2,
    defaultStartTime: '17:00',
    defaultEndTime: '22:00',
    isActive: true,
  },
];

const turnBands = {
  default: [
    { maxPartySize: 2, durationMinutes: 75 },
    { maxPartySize: 4, durationMinutes: 90 },
    { maxPartySize: 8, durationMinutes: 120 },
  ],
};

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Per-category dual-sync fields, recomputed from the live Core fixture like the real route. */
function dualSyncState(state: FixtureState) {
  const names = new Map<string, string>();
  for (const row of [...state.core.categories, ...state.google.categories]) {
    if (!names.has(slug(row.displayName))) names.set(slug(row.displayName), row.displayName);
  }
  const fields = [...names.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, label], index) => {
      const core = state.core.categories.find((row) => slug(row.displayName) === key) ?? null;
      const gbp = state.google.categories.find((row) => slug(row.displayName) === key) ?? null;
      const fieldKey = `businessContext.categories.${key}`;
      const inSync = Boolean(core && gbp && core.isPrimary === gbp.isPrimary);
      return {
        fieldKey,
        sectionKey: 'businessContext.categories',
        kind: 'businessContext.category',
        label,
        helpText: 'Business category. Export requires a Google category code.',
        conflictPolicy: 'manual',
        deletePolicy: 'manual',
        policy: {
          fieldKey,
          sectionKey: 'businessContext.categories',
          authority: 'bidirectional_manual',
          riskLevel: 'standard',
          importable: true,
          exportable: true,
          requiresManualReview: true,
          googleWriteGroup: 'location.categories',
          semanticComparator: 'category',
          canonicalizer: 'canonicalizeCategory',
          destructiveWritePossible: false,
        },
        importable: true,
        exportable: true,
        sortOrder: index,
        coreValue: core,
        gbpValue: gbp,
        coreCanonicalHash: core ? `core-${key}` : null,
        gbpCanonicalHash: gbp ? `core-${key}` : null,
        capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
        state: inSync ? 'in_sync' : core ? 'core_dirty' : 'gbp_dirty',
        lastInSyncAt: inSync ? STAMP : null,
        lastCoreChangeAt: STAMP,
        lastGbpChangeAt: STAMP,
        openCandidate: null,
      };
    });
  return {
    restaurantId: RESTAURANT_ID,
    coreSnapshot: {},
    gbpSnapshot: {},
    coreSnapshotHash: 'qa-core-hash',
    gbpSnapshotHash: 'qa-gbp-hash',
    fields,
    outboundQueue: { totalOpen: 0, autoExportable: 0, missingBaseline: 0, lastQueuedAt: null },
    lastSnapshot: null,
    control: null,
  };
}

function gbpConnection() {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: false,
    connectedGoogleEmail: 'ops@example.test',
    connectedGoogleName: 'QA Ops',
    externalAccountId: 'account-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'location-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'QA Data Hooks Restaurant',
    externalPlaceId: 'places/qa-data-hooks',
    providerTimezone: 'Europe/London',
    lastPullAt: STAMP,
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {
      details: {
        businessName: 'QA Data Hooks Restaurant',
        description: 'Fixture listing description',
        languageCode: 'en',
        openingDate: null,
        businessStatus: 'OPEN',
        isServiceAreaBusiness: false,
        canReopen: null,
        source: 'gbp',
        managedBy: 'gbp',
        lastSyncedAt: STAMP,
      },
      addresses: [],
      phoneNumbers: [],
      links: [],
      categories: [],
      serviceAreas: [],
      hours: [],
      specialHours: [],
      attributes: [],
      serviceItems: [],
    },
  };
}

class SettingsApiFixture {
  state = initialState();
  readonly log: LoggedRequest[] = [];
  readonly unexpectedWrites: LoggedRequest[] = [];
  private readonly failures = new Map<string, FailureSpec & { remaining: number }>();
  private readonly gates = new Map<string, Promise<void>>();

  /** The next `times` `method path` requests are answered with this error instead of the fixture. */
  failNext(method: string, path: string, failure: FailureSpec, times = 1) {
    this.failures.set(`${method} ${path}`, { ...failure, remaining: times });
  }

  /** Every `method path` request fails until `stopFailing` is called. */
  failAll(method: string, path: string, failure: FailureSpec) {
    this.failNext(method, path, failure, Number.POSITIVE_INFINITY);
  }

  stopFailing(method: string, path: string) {
    this.failures.delete(`${method} ${path}`);
  }

  /** Holds every GET of `path` until the returned release function is called. */
  holdGets(path: string): () => void {
    let release = () => {};
    this.gates.set(
      path,
      new Promise<void>((resolve) => {
        release = () => {
          this.gates.delete(path);
          resolve();
        };
      }),
    );
    return release;
  }

  count(method: string, path: string) {
    return this.log.filter((entry) => entry.method === method && entry.path === path).length;
  }

  async install(page: Page) {
    await page.route('**/api/ops/**', (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    this.log.push({ method, path });

    const failure = this.failures.get(`${method} ${path}`);
    if (failure) {
      failure.remaining -= 1;
      if (failure.remaining <= 0) this.failures.delete(`${method} ${path}`);
      await route.fulfill({ status: failure.status, json: failure.body });
      return;
    }

    if (method === 'GET') {
      const gate = this.gates.get(path);
      if (gate) await gate;
      await route.fulfill({ json: this.read(path) });
      return;
    }

    const body: unknown = request.postDataJSON();
    const written = this.write(method, path, body);
    if (written === undefined) {
      this.unexpectedWrites.push({ method, path });
      await route.fulfill({ status: 405, json: { error: 'qa_fixture_unhandled_write' } });
      return;
    }
    await route.fulfill({ json: written });
  }

  private read(path: string): unknown {
    switch (path) {
      case '/api/ops/restaurants':
        return {
          items: [restaurant],
          pageInfo: { hasNext: false, page: 1, pageSize: 50, total: 1 },
        };
      case BASE:
        return { restaurant };
      case `${BASE}/hours`:
        return this.state.hours;
      case `${BASE}/service-periods`:
        return { restaurantId: RESTAURANT_ID, periods: this.state.periods };
      case `${BASE}/turn-bands`:
        return { restaurantId: RESTAURANT_ID, bands: turnBands, defaults: turnBands };
      case `${BASE}/business-context`:
        return { core: this.state.core, providerSnapshot: this.state.google };
      case `${BASE}/google-business-profile`:
      case `${BASE}/google-business-profile/details`:
        return gbpConnection();
      case `${BASE}/dual-sync/state`:
        return dualSyncState(this.state);
      case '/api/ops/occasions':
        return { occasions };
      case `${BASE}/menus`:
        return { menus: [] };
      case '/api/ops/team/invitations':
        return { invites: [] };
      case '/api/ops/tables':
        return {
          tables: [],
          summary: {
            availableTables: 2,
            serviceCapacities: [],
            totalCapacity: 8,
            totalTables: 2,
            zones: [],
          },
        };
      default:
        return {};
    }
  }

  private write(method: string, path: string, body: unknown): unknown {
    if (method === 'PUT' && path === `${BASE}/hours`) {
      const next = body as HoursSnapshot;
      this.state.hours = { ...next, updatedAt: new Date().toISOString() };
      return this.state.hours;
    }
    if (method === 'PUT' && path === `${BASE}/service-periods`) {
      const rows = body as PeriodRow[];
      this.state.periods = rows.map((row, index) => ({
        ...row,
        id: row.id ?? `saved-${index}`,
        updatedAt: new Date().toISOString(),
      }));
      return { restaurantId: RESTAURANT_ID, periods: this.state.periods };
    }
    if (method === 'PUT' && path === `${BASE}/business-context`) {
      const payload = body as { categories?: Array<Partial<Category> & { displayName: string }> };
      if (payload.categories) {
        this.state.core = {
          ...this.state.core,
          categories: payload.categories.map((row, index) => ({
            ...category(
              row.id ?? `saved-cat-${index}`,
              row.displayName,
              Boolean(row.isPrimary),
              'core',
            ),
            categoryCode: row.categoryCode ?? null,
          })),
        };
      }
      return { core: this.state.core, providerSnapshot: this.state.google };
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

type Session = { context: BrowserContext; page: Page; api: SettingsApiFixture };

/** The fixture of the running test, checked for unanswered writes after it. */
let activeApi: SettingsApiFixture | null = null;

async function openSession(context: BrowserContext): Promise<Session> {
  const baseUrl = resolveBaseUrl(test.info().project.use.baseURL);
  // Anything that is not the local app host is aborted, so nothing can leave this machine.
  await context.route('**/*', async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (ALLOWED_HOSTS.has(host)) {
      await route.fallback();
      return;
    }
    await route.abort('blockedbyclient');
  });
  await context.addCookies([
    { ...QA_AUTH_COOKIE, domain: new URL(baseUrl).hostname, path: '/', sameSite: 'Lax' },
  ]);
  const page = await context.newPage();
  const api = new SettingsApiFixture();
  await api.install(page);
  activeApi = api;
  // Leaving a page with unsaved edits asks through window.confirm; the proof always leaves.
  page.on('dialog', (dialog) => void dialog.accept());
  return { context, page, api };
}

function settingsNav(page: Page) {
  return page.getByRole('navigation', { name: 'Restaurant settings' }).first();
}

async function gotoSettings(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await expect(settingsNav(page)).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

/** Client-side navigation through the settings sidebar; fails if the document reloads. */
async function clickSidebar(page: Page, name: RegExp) {
  const marker = await page.evaluate(() => {
    const token = `qa-${Math.random()}`;
    (window as Window & { __qaNoReload?: string }).__qaNoReload = token;
    return token;
  });
  const link = settingsNav(page).getByRole('link', { name }).first();
  const href = await link.getAttribute('href');
  await link.click();
  if (href) {
    const target = href.split('#')[0] ?? href;
    await page.waitForURL((url) => url.pathname.endsWith(target.replace(/^.*\/app/, '')), {
      timeout: 60_000,
    });
  }
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  const after = await page.evaluate(
    () => (window as Window & { __qaNoReload?: string }).__qaNoReload ?? null,
  );
  expect(after, 'sidebar navigation must not reload the document').toBe(marker);
}

async function screenshot(page: Page, name: string) {
  const dir = process.env.QA_DATA_HOOKS_SHOTS;
  if (!dir) return;
  await page.evaluate(() =>
    document.querySelectorAll('[data-react-grab]').forEach((node) => node.remove()),
  );
  // Settings content fades in over ~0.2 s after a client-side navigation.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const HOURS = `${BASE}/hours`;
const PERIODS = `${BASE}/service-periods`;
const TURN_BANDS = `${BASE}/turn-bands`;
const BUSINESS_CONTEXT = `${BASE}/business-context`;
const DUAL_SYNC_STATE = `${BASE}/dual-sync/state`;
const DUAL_SYNC_REFRESH = `${BASE}/dual-sync/refresh`;
const GBP_DETAILS = `${BASE}/google-business-profile/details`;

const CONFLICT_COPY =
  'Someone else changed these settings. Reload to see the latest, then reapply your edits.';

function saveBar(page: Page) {
  return page.locator('[data-slot="settings-save-bar"]');
}

async function expectSafeFailure(page: Page, section: string, reasonCode: string) {
  const bar = saveBar(page);
  await expect(bar).toContainText(`${section} not saved.`);
  await expect(bar).toContainText(`Reason code ${reasonCode}`);
  await expect(bar.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('qa_sentinel_internal');
}

async function openWeekday(page: Page, dayOfWeek: number) {
  const panel = page.locator(`#availability-day-${dayOfWeek}-panel`);
  // The route scrolls to its section after hydration, which can swallow an early click.
  await expect(async () => {
    if (await panel.isHidden()) {
      await page.locator(`#availability-day-${dayOfWeek} > button`).click();
    }
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return panel;
}

async function closeSunday(page: Page) {
  await gotoSettings(page, '/settings/restaurant/operating-hours');
  const panel = await openWeekday(page, 0);
  await panel.getByRole('switch', { name: 'Open on Sundays' }).click();
  await expect(panel).toContainText('Closed every Sunday.');
  await expect(saveBar(page)).toBeVisible();
}

async function turnOffMondayLunch(page: Page) {
  await gotoSettings(page, '/settings/restaurant/service-periods');
  const panel = await openWeekday(page, 1);
  await panel.getByRole('switch', { name: 'Lunch' }).click();
  await expect(saveBar(page)).toBeVisible();
}

async function addGastropubCategory(page: Page) {
  await gotoSettings(page, '/settings/restaurant/discovery');
  await expect(page.getByText('Google differs on 1 category (Gastropub).')).toBeVisible();
  await page
    .getByPlaceholder(/add a category/i)
    .first()
    .fill('Gastropub');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await expect(saveBar(page)).toBeVisible();
}

function overviewCheck(page: Page, text: string) {
  return page.getByRole('main').getByText(text, { exact: true });
}

test.describe('restaurant settings data hooks browser proof', () => {
  test.skip(process.env.QA_DATA_HOOKS !== '1', 'Opt-in proof: set QA_DATA_HOOKS=1');

  test.afterEach(() => {
    if (activeApi) {
      expect(activeApi.unexpectedWrites, 'every write must be answered by a fixture').toEqual([]);
    }
    activeApi = null;
  });

  // ---------------------------------------------------------------- operating hours
  test('operating hours: saved value reaches overview and availability without a reload @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    // Closing a day narrows the hours, so the page writes Meal times (Sunday's meals go) first.
    await closeSunday(page);
    const hoursGetsBefore = api.count('GET', HOURS);
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await expect(page.getByText(/Open 6 days a week/)).toBeVisible();
    await expect(saveBar(page)).toHaveCount(0);
    expect(api.count('PUT', HOURS)).toBe(1);
    expect(api.state.hours.weekly.find((row) => row.dayOfWeek === 0)?.isClosed).toBe(true);
    // The PUT response is authoritative: no refetch of the resource the save just wrote.
    expect(api.count('GET', HOURS)).toBe(hoursGetsBefore);
    await screenshot(page, 'hours-a1-saved');

    await clickSidebar(page, /^Restaurant setup$/);
    await expect(overviewCheck(page, '6 days open each week')).toBeVisible();
    await expect(overviewCheck(page, '12 meal times set')).toBeVisible();
    await screenshot(page, 'hours-a2-overview');

    await clickSidebar(page, /Availability & Booking types/);
    await expect(page.getByText(/Open 6 days a week/)).toBeVisible();
    await expect(page.locator('#availability-day-0')).toContainText(/Closed/);
    await screenshot(page, 'hours-a3-availability');
  });

  test('operating hours: a 500 on save rolls the cache back and shows safe copy @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await closeSunday(page);
    const hoursGetsBefore = api.count('GET', HOURS);
    api.failNext('PUT', HOURS, { status: 500, body: { error: SERVER_SENTINEL } });
    // Hold the post-rollback re-sync GET, so the overview can only show what the rollback left.
    const releaseHours = api.holdGets(HOURS);
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expectSafeFailure(page, 'Opening hours and special dates', 'HTTP_500');
    await expect(saveBar(page)).toContainText('Saved: Meal times.');
    // The rollback re-syncs the hours; that GET is held until the overview has rendered.
    await expect.poll(() => api.count('GET', HOURS)).toBeGreaterThan(hoursGetsBefore);
    // Edits stay in the draft for a retry.
    await expect(page.locator('#availability-day-0-panel')).toContainText('Closed every Sunday.');
    expect(api.state.hours.weekly.find((row) => row.dayOfWeek === 0)?.isClosed).toBe(false);
    await screenshot(page, 'hours-b1-500-save-bar');

    await clickSidebar(page, /^Restaurant setup$/);
    // Hours show the rolled-back cache; the Meal times step that did save is kept.
    await expect(overviewCheck(page, '7 days open each week')).toBeVisible();
    await expect(overviewCheck(page, '12 meal times set')).toBeVisible();
    await screenshot(page, 'hours-b2-overview-rolled-back');
    releaseHours();
    await page.waitForTimeout(500);
    await expect(overviewCheck(page, '7 days open each week')).toBeVisible();
  });

  test('operating hours: a 409 on save shows the conflict message @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await closeSunday(page);
    api.failNext('PUT', HOURS, { status: 409, body: { error: SERVER_SENTINEL } });
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(saveBar(page)).toContainText(CONFLICT_COPY);
    await expectSafeFailure(page, 'Opening hours and special dates', 'CONFLICT');
    await screenshot(page, 'hours-c-409-save-bar');
  });

  // ---------------------------------------------------------------- service periods
  test('service periods: saved value reaches overview, turn bands and availability without a reload @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await turnOffMondayLunch(page);
    const turnBandGetsBefore = api.count('GET', TURN_BANDS);
    const periodGetsBefore = api.count('GET', PERIODS);
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await expect(saveBar(page)).toHaveCount(0);
    expect(api.count('PUT', PERIODS)).toBe(1);
    expect(api.state.periods).toHaveLength(13);
    // Turn-band defaults are derived from service periods on the server, so they are refetched.
    await expect.poll(() => api.count('GET', TURN_BANDS)).toBeGreaterThan(turnBandGetsBefore);
    expect(api.count('GET', PERIODS)).toBe(periodGetsBefore);
    await screenshot(page, 'periods-a1-saved');

    await clickSidebar(page, /^Restaurant setup$/);
    await expect(overviewCheck(page, '13 meal times set')).toBeVisible();
    await screenshot(page, 'periods-a2-overview');

    await clickSidebar(page, /Availability & Booking types/);
    const monday = page.locator('#availability-day-1');
    await expect(monday).toContainText('Dinner 17:00–22:00');
    await expect(monday).not.toContainText('Lunch 12:00–15:00');
    await expect(page.locator('#availability-day-2')).toContainText('Lunch 12:00–15:00');
    await screenshot(page, 'periods-a3-availability');
  });

  test('service periods: a 500 on save rolls the cache back and shows safe copy @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await turnOffMondayLunch(page);
    const periodGetsBefore = api.count('GET', PERIODS);
    api.failNext('PUT', PERIODS, { status: 500, body: { error: SERVER_SENTINEL } });
    const releasePeriods = api.holdGets(PERIODS);
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expectSafeFailure(page, 'Meal times', 'HTTP_500');
    await expect.poll(() => api.count('GET', PERIODS)).toBeGreaterThan(periodGetsBefore);
    await expect(page.locator('#availability-day-1')).toContainText('Lunch off');
    expect(api.state.periods).toHaveLength(14);
    await screenshot(page, 'periods-b1-500-save-bar');

    await clickSidebar(page, /^Restaurant setup$/);
    await expect(overviewCheck(page, '14 meal times set')).toBeVisible();
    await screenshot(page, 'periods-b2-overview-rolled-back');
    releasePeriods();
    await page.waitForTimeout(500);
    await expect(overviewCheck(page, '14 meal times set')).toBeVisible();
  });

  test('service periods: a 409 on save shows the conflict message @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await turnOffMondayLunch(page);
    api.failNext('PUT', PERIODS, { status: 409, body: { error: SERVER_SENTINEL } });
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(saveBar(page)).toContainText(CONFLICT_COPY);
    await expectSafeFailure(page, 'Meal times', 'CONFLICT');
    await screenshot(page, 'periods-c-409-save-bar');
  });

  // ---------------------------------------------------------------- discovery
  test('discovery: saved category clears Google drift on the GBP page without a reload @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await addGastropubCategory(page);
    const driftGetsBefore = api.count('GET', DUAL_SYNC_STATE);
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(saveBar(page)).toHaveCount(0);
    expect(api.count('PUT', BUSINESS_CONTEXT)).toBe(1);
    expect(api.state.core.categories.map((row) => row.displayName)).toEqual([
      'Restaurant',
      'Gastropub',
    ]);
    // Dual-sync state recomputes Core live, so the save invalidates it.
    await expect.poll(() => api.count('GET', DUAL_SYNC_STATE)).toBeGreaterThan(driftGetsBefore);
    await screenshot(page, 'discovery-a1-saved');

    await clickSidebar(page, /Google Business/);
    await expect(page.getByText(/^0 differences between Nabatable and Google\./)).toBeVisible();
    await expect(
      page.getByText('Nabatable and Google match. There is nothing to review.'),
    ).toBeVisible();
    await expect(page.getByText('Gastropub', { exact: true })).toHaveCount(0);
    await expect(
      settingsNav(page).getByRole('link', { name: /Discovery details/ }),
    ).not.toContainText('Google');
    await screenshot(page, 'discovery-a2-gbp');
  });

  test('discovery: a 500 on save keeps saved data and shows safe copy @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await addGastropubCategory(page);
    api.failNext('PUT', BUSINESS_CONTEXT, { status: 500, body: { error: SERVER_SENTINEL } });
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expectSafeFailure(page, 'Categories', 'HTTP_500');
    expect(api.state.core.categories.map((row) => row.displayName)).toEqual(['Restaurant']);
    await screenshot(page, 'discovery-b1-500-save-bar');

    await clickSidebar(page, /Google Business/);
    await expect(
      page.getByText('1 difference between Nabatable and Google', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('Gastropub', { exact: true }).first()).toBeVisible();
    await screenshot(page, 'discovery-b2-gbp-unchanged');
  });

  test('discovery: a 409 on save shows the conflict message @local-only', async ({ context }) => {
    const { page, api } = await openSession(context);

    await addGastropubCategory(page);
    api.failNext('PUT', BUSINESS_CONTEXT, { status: 409, body: { error: SERVER_SENTINEL } });
    await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(saveBar(page)).toContainText(CONFLICT_COPY);
    await expectSafeFailure(page, 'Categories', 'CONFLICT');
    await screenshot(page, 'discovery-c-409-save-bar');
  });

  // ---------------------------------------------------------------- raw error copy
  test('google business profile: a 500 on the details load shows fixed copy, never the server text @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    // The shell prefetch and the section query (with its retries) all fail, so the blocking
    // error state is shown.
    api.failAll('GET', GBP_DETAILS, { status: 500, body: { error: SERVER_SENTINEL } });
    await page.goto('/settings/restaurant/google-business-profile', {
      waitUntil: 'domcontentloaded',
      timeout: 240_000,
    });
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Unable to load Google Business Profile' });
    await expect(alert).toBeVisible({ timeout: 120_000 });
    await expect(alert).toContainText(
      'Google Business Profile could not be loaded. Reason code: HTTP_500. Your saved settings are unchanged.',
    );
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('qa_sentinel_internal');
    expect(api.count('GET', GBP_DETAILS)).toBeGreaterThanOrEqual(3);
    await screenshot(page, 'followup-a1-gbp-details-500');

    // Once the endpoint recovers, Try again loads the page.
    api.stopFailing('GET', GBP_DETAILS);
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText(/differences? between Nabatable and Google/).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('qa_sentinel_internal');
  });

  test('google business profile: a failed dual-sync refresh shows fixed copy, never the server text @local-only', async ({
    context,
  }) => {
    const { page, api } = await openSession(context);

    await gotoSettings(page, '/settings/restaurant/google-business-profile');
    const refresh = page.locator('[data-dual-sync-action="refresh"]');
    await expect(refresh).toBeEnabled();
    api.failNext('POST', DUAL_SYNC_REFRESH, { status: 500, body: { error: SERVER_SENTINEL } });
    await refresh.click();
    // The app layout mounts two sonner Toasters, so each toast renders twice.
    await expect(page.getByText('Refresh failed. Reason code: HTTP_500.').first()).toBeVisible();
    expect(api.count('POST', DUAL_SYNC_REFRESH)).toBe(1);
    await expect(page.locator('body')).not.toContainText('qa_sentinel_internal');
    await screenshot(page, 'followup-b1-dual-sync-refresh-500');
  });
});
