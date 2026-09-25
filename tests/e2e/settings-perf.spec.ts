import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { installPerfApiMocks } from './helpers/settings-perf-fixtures';
import {
  installSettingsPerfInstrumentation,
  type PerfEventEntry,
  type PerfPageApi,
  type PerfScanResult,
  type PerfStorageWrite,
  type PerfTrackedRenders,
} from './helpers/settings-perf-instrumentation';

import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

/**
 * Opt-in performance measurement for the restaurant settings routes.
 *
 *   QA_PERF=1 QA_PERF_OUT=/abs/path/result.json QA_PERF_BASE_URL=http://app.localhost:5182 \
 *     pnpm exec playwright test -c tests/e2e/settings-perf.playwright.config.ts
 *
 * Skipped unless QA_PERF=1. Refuses to run against anything but a local host. All `/api/ops/**`
 * traffic is answered by read-only route mocks; methods are documented in the helpers and in
 * the `methods` block of the JSON result.
 */

const ALLOWED_HOSTS = new Set(['localhost', 'app.localhost', '127.0.0.1']);
const RUNS = Number.parseInt(process.env.QA_PERF_RUNS ?? '3', 10);
const HOVER_PAUSE_MS = 1_500;
const TYPED_TEXT = 'Seafood bistro and oyster bar';
const KEY_DELAY_MS = 80;

const SHELL_COMPONENTS = [
  'RestaurantSettingsPageShell',
  'RestaurantSettingsFocusedShell',
  'RestaurantSettingsChromeHeader',
  'RestaurantSettingsSidebarNav',
  'DiscoveryEditor',
  'CategoriesPanel',
  'AttributesPanel',
  'ServiceAreasPanel',
];
const PROVIDER_COMPONENTS = [
  'QueryClientProvider',
  'PostHogProvider',
  'AppProviders',
  'QueryLayer',
  'SupabaseSessionProvider',
];
const WARM_ROUTES = [
  '/settings/restaurant',
  '/settings/restaurant/profile',
  '/settings/restaurant/discovery',
  '/settings/restaurant/google-business-profile',
  '/settings/restaurant/availability',
  '/settings/restaurant/menu',
  '/settings/restaurant/tables',
  '/settings/restaurant/team',
  '/settings/restaurant/staff-communications',
];
const GBP_ROUTES: Record<string, string> = {
  overview: '/settings/restaurant',
  team: '/settings/restaurant/team',
  tables: '/settings/restaurant/tables',
  profile: '/settings/restaurant/profile',
  availability: '/settings/restaurant/availability',
};
const NAV_BURST: RegExp[] = [
  /discovery/i,
  /availability/i,
  /menu/i,
  /tables/i,
  /team/i,
  /profile/i,
];

type RecordedRequest = { path: string; rsc: boolean };
type PerfSession = { context: BrowserContext; page: Page; requests: RecordedRequest[] };
type PerfWindow = Window & { __settingsPerf?: PerfPageApi };

function resolveBaseUrl(configured: string | undefined): string {
  const baseUrl = process.env.QA_PERF_BASE_URL ?? configured ?? 'http://app.localhost:5182';
  const host = new URL(baseUrl).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `settings-perf refuses to run against "${host}": only localhost, app.localhost or 127.0.0.1`,
    );
  }
  return baseUrl;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return round(sorted[rank]);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function isOpsApi(request: RecordedRequest) {
  return request.path.startsWith('/api/ops/');
}

function isGoogleRequest(request: RecordedRequest) {
  return request.path.includes('/google-business-profile') || request.path.includes('/dual-sync');
}

async function openSession(browser: Browser, baseUrl: string): Promise<PerfSession> {
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1280, height: 900 },
  });
  await context.addCookies([
    {
      name: '__nabatable_qa_ops_auth',
      value: 'enabled',
      domain: new URL(baseUrl).hostname,
      path: '/',
      sameSite: 'Lax',
    },
  ]);
  await context.addInitScript(installSettingsPerfInstrumentation);
  const page = await context.newPage();
  await installPerfApiMocks(page);
  const requests: RecordedRequest[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const rsc = url.searchParams.has('_rsc') || request.headers()['rsc'] === '1';
    requests.push({ path: url.pathname, rsc });
  });
  return { context, page, requests };
}

async function settle(page: Page, extraMs = 600) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  // Settings content fades in over ~0.2 s.
  await page.waitForTimeout(extraMs);
}

async function gotoSettings(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await expect(page.locator('main').first()).toBeVisible({ timeout: 120_000 });
  await expect(settingsNav(page)).toBeVisible({ timeout: 60_000 });
  await settle(page);
}

function settingsNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Restaurant settings' }).first();
}

function navLink(page: Page, name: RegExp): Locator {
  return settingsNav(page).getByRole('link', { name }).first();
}

async function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

async function clickNav(page: Page, name: RegExp) {
  const link = navLink(page, name);
  const href = await link.getAttribute('href');
  await link.click();
  if (href) {
    const segment = href.split('/').filter(Boolean).pop() ?? '';
    await page.waitForURL((url) => url.pathname.endsWith(segment), { timeout: 60_000 });
  }
}

async function warmUp(browser: Browser, baseUrl: string) {
  const { context, page } = await openSession(browser, baseUrl);
  try {
    for (const route of WARM_ROUTES) {
      await gotoSettings(page, route);
    }
    for (const name of NAV_BURST) {
      await clickNav(page, name);
      await settle(page, 300);
    }
  } finally {
    await context.close();
  }
}

// (a) Availability sidebar link: hover, pause, click, then re-hover within staleTime.
async function measureAvailabilityHover(browser: Browser, baseUrl: string) {
  const { context, page, requests } = await openSession(browser, baseUrl);
  try {
    await gotoSettings(page, '/settings/restaurant/profile');
    await page.mouse.move(1, 1);

    const hoverStart = requests.length;
    await navLink(page, /availability/i).hover();
    await page.waitForTimeout(HOVER_PAUSE_MS);
    const hover = requests.slice(hoverStart);

    const clickStart = requests.length;
    await clickNav(page, /availability/i);
    await settle(page);
    const click = requests.slice(clickStart);

    await clickNav(page, /profile/i);
    await settle(page);
    await page.mouse.move(1, 1);
    const repeatStart = requests.length;
    await navLink(page, /availability/i).hover();
    await page.waitForTimeout(HOVER_PAUSE_MS);
    const repeat = requests.slice(repeatStart);

    const hoverOps = hover.filter(isOpsApi);
    const clickOps = click.filter(isOpsApi);
    return {
      hoverOpsRequests: hoverOps.length,
      clickOpsRequests: clickOps.length,
      hoverPauseClickTotalOpsRequests: hoverOps.length + clickOps.length,
      repeatHoverOpsRequests: repeat.filter(isOpsApi).length,
      hoverRscRequests: hover.filter((request) => request.rsc).length,
      clickRscRequests: click.filter((request) => request.rsc).length,
      hoverPaths: hoverOps.map((request) => request.path),
      clickPaths: clickOps.map((request) => request.path),
      repeatHoverPaths: repeat.filter(isOpsApi).map((request) => request.path),
    };
  } finally {
    await context.close();
  }
}

function summariseWrites(writes: PerfStorageWrite[], windowMs: number) {
  const writers = new Set(writes.map((write) => write.writer).filter((writer) => writer !== null));
  const bytes = writes.reduce((total, write) => total + write.bytes, 0);
  const seconds = windowMs / 1000;
  return {
    writes: writes.length,
    windowMs: Math.round(windowMs),
    writesPerSecond: seconds > 0 ? round(writes.length / seconds) : null,
    bytesWritten: bytes,
    bytesPerSecond: seconds > 0 ? Math.round(bytes / seconds) : null,
    attributedWriterCount: writers.size,
    unattributedWrites: writes.filter((write) => write.writer === null).length,
  };
}

// (b) QueryClient instances / persister writers / PostHog, and (c) storage writes during a
// rapid sidebar-navigation burst.
async function measureClientsAndStorageBurst(browser: Browser, baseUrl: string) {
  const { context, page } = await openSession(browser, baseUrl);
  try {
    await gotoSettings(page, '/settings/restaurant/profile');
    const names = PROVIDER_COMPONENTS;
    const scanBefore = await page.evaluate((componentNames) => {
      const api = (window as PerfWindow).__settingsPerf;
      if (!api) throw new Error('settings perf instrumentation missing');
      return { scan: api.scan(componentNames), hookInjected: api.hookInjected };
    }, names);
    const loadWrites = await page.evaluate(
      () => (window as PerfWindow).__settingsPerf?.storageWrites.length ?? 0,
    );

    const start = await pageNow(page);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      for (const name of NAV_BURST) {
        await clickNav(page, name);
        await page.waitForTimeout(350);
      }
    }
    const end = await pageNow(page);
    const burstWrites = await page.evaluate(
      ({ from, to }) =>
        ((window as PerfWindow).__settingsPerf?.storageWrites ?? []).filter(
          (write) => write.t >= from && write.t <= to,
        ),
      { from: start, to: end },
    );
    const scanAfter: PerfScanResult = await page.evaluate((componentNames) => {
      const api = (window as PerfWindow).__settingsPerf;
      if (!api) throw new Error('settings perf instrumentation missing');
      return api.scan(componentNames);
    }, names);

    return {
      hookInjected: scanBefore.hookInjected,
      queryClientCount: scanAfter.queryClientCount,
      persisterWriterCount: scanAfter.persisterWriterCount,
      queryClients: scanAfter.queryClients,
      componentCounts: scanAfter.componentCounts,
      posthogInitWarnings: scanAfter.posthogWarnings,
      posthogGlobalPresent: scanAfter.posthogGlobalPresent,
      initialLoadStorageWrites: loadWrites,
      navigationBurst: {
        clicks: NAV_BURST.length * 2,
        ...summariseWrites(burstWrites, end - start),
      },
    };
  } finally {
    await context.close();
  }
}

// (d) Google (GBP connection + dual-sync) requests per route on a cold load.
async function measureGoogleRequests(browser: Browser, baseUrl: string) {
  const result: Record<
    string,
    { opsRequests: number; googleRequests: number; googlePaths: string[] }
  > = {};
  for (const [label, route] of Object.entries(GBP_ROUTES)) {
    const { context, page, requests } = await openSession(browser, baseUrl);
    try {
      await gotoSettings(page, route);
      await settle(page, 1_500);
      const google = requests.filter(isGoogleRequest);
      result[label] = {
        opsRequests: requests.filter(isOpsApi).length,
        googleRequests: google.length,
        googlePaths: google.map((request) => request.path),
      };
    } finally {
      await context.close();
    }
  }
  return result;
}

type TypingSample = {
  target: string;
  keys: number;
  rafLatencyP50Ms: number | null;
  rafLatencyP95Ms: number | null;
  rafLatencyMaxMs: number | null;
  eventTimingSlowInteractions: number;
  eventTimingP50Ms: number | null;
  eventTimingP95Ms: number | null;
  eventTimingMaxMs: number | null;
  longTasks: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  reactCommits: number;
  reactCommitsPerKey: number;
  trackedRenders: PerfTrackedRenders;
  trackedRendersPerKey: Record<string, number>;
  storage: ReturnType<typeof summariseWrites>;
};

async function typeAndMeasure(page: Page, input: Locator, target: string): Promise<TypingSample> {
  await input.click();
  await page.keyboard.press('End');
  await page.waitForTimeout(400);
  const start = await page.evaluate(() => {
    const api = (window as PerfWindow).__settingsPerf;
    if (!api) throw new Error('settings perf instrumentation missing');
    api.keyLatencies = [];
    api.resetTracked();
    api.keyTimingActive = true;
    return { t: performance.now(), commits: api.commits };
  });
  await page.keyboard.type(TYPED_TEXT, { delay: KEY_DELAY_MS });
  await page.waitForTimeout(800);
  const end = await page.evaluate(
    ({ from }) => {
      const api = (window as PerfWindow).__settingsPerf;
      if (!api) throw new Error('settings perf instrumentation missing');
      api.keyTimingActive = false;
      const to = performance.now();
      return {
        to,
        commits: api.commits,
        latencies: [...api.keyLatencies],
        events: api.eventEntries.filter((entry) => entry.start >= from && entry.start <= to),
        longTasks: api.longTasks.filter((task) => task.start >= from && task.start <= to),
        writes: api.storageWrites.filter((write) => write.t >= from && write.t <= to),
        renders: api.trackedRenders(),
      };
    },
    { from: start.t },
  );

  const byInteraction = new Map<number, number>();
  for (const entry of end.events as PerfEventEntry[]) {
    if (entry.interactionId <= 0) continue;
    byInteraction.set(
      entry.interactionId,
      Math.max(byInteraction.get(entry.interactionId) ?? 0, entry.duration),
    );
  }
  const interactionDurations = [...byInteraction.values()];
  const keys = TYPED_TEXT.length;
  const commits = end.commits - start.commits;
  const trackedRendersPerKey: Record<string, number> = {};
  for (const [name, renders] of Object.entries(end.renders)) {
    trackedRendersPerKey[name] = round(renders / keys);
  }

  return {
    target,
    keys,
    rafLatencyP50Ms: percentile(end.latencies, 50),
    rafLatencyP95Ms: percentile(end.latencies, 95),
    rafLatencyMaxMs: percentile(end.latencies, 100),
    eventTimingSlowInteractions: interactionDurations.length,
    eventTimingP50Ms: percentile(interactionDurations, 50),
    eventTimingP95Ms: percentile(interactionDurations, 95),
    eventTimingMaxMs: percentile(interactionDurations, 100),
    longTasks: end.longTasks.length,
    longTaskTotalMs: round(end.longTasks.reduce((total, task) => total + task.duration, 0)),
    longTaskMaxMs: round(end.longTasks.reduce((max, task) => Math.max(max, task.duration), 0)),
    reactCommits: commits,
    reactCommitsPerKey: round(commits / keys),
    trackedRenders: end.renders,
    trackedRendersPerKey,
    storage: summariseWrites(end.writes, end.to - start.t),
  };
}

// (e) Discovery editor with the large fixture: keystroke latency, long tasks, commits.
async function measureDiscoveryTyping(browser: Browser, baseUrl: string) {
  const { context, page } = await openSession(browser, baseUrl);
  try {
    await gotoSettings(page, '/settings/restaurant/discovery');
    await expect(page.getByRole('heading', { name: 'Discovery details' }).first()).toBeVisible();
    await settle(page, 1_000);
    const trackedCount = await page.evaluate((names) => {
      const api = (window as PerfWindow).__settingsPerf;
      if (!api) throw new Error('settings perf instrumentation missing');
      return api.track(names);
    }, SHELL_COMPONENTS);

    const samples: TypingSample[] = [];
    const newCategory = page.getByPlaceholder(/add a category/i).first();
    await expect(newCategory).toBeVisible();
    samples.push(await typeAndMeasure(page, newCategory, 'new-category-input'));

    const disclosure = page.getByRole('button', { name: /category codes/i }).first();
    if ((await disclosure.count()) > 0) {
      if ((await disclosure.getAttribute('aria-expanded')) !== 'true') {
        await disclosure.click();
        await page.waitForTimeout(500);
      }
    }
    const categoryName = page.getByLabel('Category name', { exact: true }).first();
    if (await categoryName.isVisible().catch(() => false)) {
      samples.push(await typeAndMeasure(page, categoryName, 'category-name-draft-field'));
    }

    return { trackedFibers: trackedCount, samples };
  } finally {
    await context.close();
  }
}

function medianOf<T>(runs: T[], pick: (run: T) => number | null): number | null {
  return median(runs.map(pick).filter((value): value is number => value !== null));
}

test.describe('restaurant settings performance measurement', () => {
  test.skip(process.env.QA_PERF !== '1', 'Opt-in measurement: set QA_PERF=1');

  test('collects settings performance metrics @perf @local-only', async ({ browser }, testInfo) => {
    test.setTimeout(45 * 60_000);
    const baseUrl = resolveBaseUrl(testInfo.project.use.baseURL);
    const outPath = process.env.QA_PERF_OUT;
    if (!outPath) {
      throw new Error('QA_PERF_OUT must name the JSON result path');
    }
    const runs = Number.isInteger(RUNS) && RUNS > 0 ? RUNS : 3;

    await warmUp(browser, baseUrl);

    const hoverRuns = [];
    const clientRuns = [];
    const googleRuns = [];
    const typingRuns = [];
    for (let run = 0; run < runs; run += 1) {
      hoverRuns.push(await measureAvailabilityHover(browser, baseUrl));
      clientRuns.push(await measureClientsAndStorageBurst(browser, baseUrl));
      googleRuns.push(await measureGoogleRequests(browser, baseUrl));
      typingRuns.push(await measureDiscoveryTyping(browser, baseUrl));
    }

    const googleMedian: Record<string, number | null> = {};
    for (const label of Object.keys(GBP_ROUTES)) {
      googleMedian[label] = medianOf(googleRuns, (run) => run[label]?.googleRequests ?? null);
    }

    const typingTargets = [
      ...new Set(typingRuns.flatMap((run) => run.samples.map((s) => s.target))),
    ];
    const typingMedian: Record<string, Record<string, number | null>> = {};
    for (const target of typingTargets) {
      const samples = typingRuns
        .map((run) => run.samples.find((sample) => sample.target === target))
        .filter((sample): sample is TypingSample => sample !== undefined);
      const shellRenders = (sample: TypingSample) =>
        sample.trackedRendersPerKey.RestaurantSettingsFocusedShell ??
        sample.trackedRendersPerKey.RestaurantSettingsPageShell ??
        null;
      typingMedian[target] = {
        rafLatencyP50Ms: medianOf(samples, (s) => s.rafLatencyP50Ms),
        rafLatencyP95Ms: medianOf(samples, (s) => s.rafLatencyP95Ms),
        eventTimingSlowInteractions: medianOf(samples, (s) => s.eventTimingSlowInteractions),
        eventTimingP95Ms: medianOf(samples, (s) => s.eventTimingP95Ms),
        longTasks: medianOf(samples, (s) => s.longTasks),
        longTaskTotalMs: medianOf(samples, (s) => s.longTaskTotalMs),
        reactCommitsPerKey: medianOf(samples, (s) => s.reactCommitsPerKey),
        shellRendersPerKey: medianOf(samples, shellRenders),
        discoveryEditorRendersPerKey: medianOf(
          samples,
          (s) => s.trackedRendersPerKey.DiscoveryEditor ?? null,
        ),
        storageWritesPerSecond: medianOf(samples, (s) => s.storage.writesPerSecond),
      };
    }

    const result = {
      meta: {
        label: process.env.QA_PERF_LABEL ?? null,
        baseUrl,
        runs,
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        viewport: '1280x900',
        fixture: { categories: 40, amenities: 60, serviceAreas: 20 },
      },
      methods: {
        availabilityHover:
          'Fresh context on Profile; hover the Availability sidebar link, wait 1.5 s, click, settle (networkidle<=5 s + 0.6 s). Then client-side back to Profile and re-hover (1.5 s). Counts page requests whose path starts with /api/ops/ (route-mocked); RSC counts use ?_rsc or rsc:1.',
        queryClients:
          'React DevTools hook stub (addInitScript) collects fiber roots; distinct memoizedProps.client objects with getQueryCache() are QueryClients. Persister writers = clients whose QueryCache listeners include a function whose source mentions persistQueryClientSave. Write attribution wraps each client QueryCache#getAll (dehydrate calls it synchronously before an unthrottled setItem).',
        posthog:
          'PostHog is disabled locally (no NEXT_PUBLIC_POSTHOG_KEY in the isolated server), so init is not observable; posthogInitWarnings counts "[PostHog] Missing ..." console warnings (one per provider init attempt, doubled by StrictMode effects in dev) and componentCounts.PostHogProvider counts mounted providers.',
        storageBurst:
          'Storage.prototype.setItem wrapped in addInitScript; counts writes to keys starting with "query-cache". Burst = 12 sidebar clicks (Discovery, Availability, Menu, Tables, Team, Profile x2) 350 ms apart after warm-up.',
        googleRequests:
          'Fresh context per route; cold load, settle + 1.5 s; counts /api/ops requests whose path contains /google-business-profile or /dual-sync.',
        discoveryTyping: `Discovery editor with the large fixture. "${TYPED_TEXT}" typed at ${KEY_DELAY_MS} ms/key into the new-category input and into the first "Category name" draft field. rafLatency = keydown event.timeStamp to the task after the next animation frame. Event Timing = PerformanceObserver type "event" durationThreshold 16 (only interactions >= 16 ms are reported; max duration per interactionId). Long tasks = PerformanceObserver longtask. React commits = onCommitFiberRoot calls on the DevTools hook stub; component renders = new (memoizedProps, memoizedState) pair on a tracked fiber per commit.`,
      },
      availabilityHover: {
        runs: hoverRuns,
        median: {
          hoverOpsRequests: medianOf(hoverRuns, (run) => run.hoverOpsRequests),
          clickOpsRequests: medianOf(hoverRuns, (run) => run.clickOpsRequests),
          hoverPauseClickTotalOpsRequests: medianOf(
            hoverRuns,
            (run) => run.hoverPauseClickTotalOpsRequests,
          ),
          repeatHoverOpsRequests: medianOf(hoverRuns, (run) => run.repeatHoverOpsRequests),
        },
      },
      queryClients: {
        runs: clientRuns,
        median: {
          queryClientCount: medianOf(clientRuns, (run) => run.queryClientCount),
          persisterWriterCount: medianOf(clientRuns, (run) => run.persisterWriterCount),
          posthogProviderCount: medianOf(
            clientRuns,
            (run) => run.componentCounts.PostHogProvider ?? null,
          ),
          posthogInitWarnings: medianOf(clientRuns, (run) => run.posthogInitWarnings),
          navigationBurstWritesPerSecond: medianOf(
            clientRuns,
            (run) => run.navigationBurst.writesPerSecond,
          ),
          navigationBurstWrites: medianOf(clientRuns, (run) => run.navigationBurst.writes),
          navigationBurstAttributedWriters: medianOf(
            clientRuns,
            (run) => run.navigationBurst.attributedWriterCount,
          ),
        },
      },
      googleRequests: { runs: googleRuns, median: googleMedian },
      discoveryTyping: { runs: typingRuns, median: typingMedian },
    };

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
    await testInfo.attach('settings-perf.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });

    expect(hoverRuns).toHaveLength(runs);
  });
});
