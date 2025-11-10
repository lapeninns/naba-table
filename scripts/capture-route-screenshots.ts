import { mkdirSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = process.env.ROUTE_SNAPSHOT_BASE_URL ?? 'http://127.0.0.1:3000';
const SNAPSHOT_EMAIL = process.env.ROUTE_SNAPSHOT_EMAIL;
const SNAPSHOT_PASSWORD = process.env.ROUTE_SNAPSHOT_PASSWORD;

const timestamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..*/, '');
const outputDir = resolve('reports', 'route-screenshots', timestamp);

const ROUTES: Array<{
  path: string;
  label: string;
  auth?: 'user' | 'admin';
  waitFor?: string;
}> = [
  { path: '/', label: 'home' },
  { path: '/browse', label: 'browse' },
  { path: '/blog', label: 'blog' },
  { path: '/pricing', label: 'pricing' },
  { path: '/privacy-policy', label: 'privacy-policy' },
  { path: '/terms/togo', label: 'terms-togo' },
  { path: '/terms/venue', label: 'terms-venue' },
  { path: '/reserve', label: 'reserve' },
  { path: '/create', label: 'create' },
  { path: '/checkout', label: 'checkout' },
  { path: '/thank-you', label: 'thank-you' },
  { path: '/tos', label: 'tos' },
  { path: '/signin', label: 'signin' },
  { path: '/reserve/r/white-horse-pub-waterbeach', label: 'reserve-restaurant' },
  { path: '/item/white-horse-pub-waterbeach', label: 'item-detail' },
  { path: '/my-bookings', label: 'my-bookings', auth: 'user' },
  { path: '/profile/manage', label: 'profile-manage', auth: 'user' },
  { path: '/ops', label: 'ops-dashboard', auth: 'admin' },
  { path: '/ops/bookings', label: 'ops-bookings', auth: 'admin' },
  { path: '/ops/bookings/new', label: 'ops-bookings-new', auth: 'admin' },
  { path: '/ops/customer-details', label: 'ops-customer-details', auth: 'admin' },
  { path: '/ops/rejections', label: 'ops-rejections', auth: 'admin' },
  { path: '/ops/restaurant-settings', label: 'ops-restaurant-settings', auth: 'admin' },
  { path: '/ops/tables', label: 'ops-tables', auth: 'admin' },
  { path: '/ops/team', label: 'ops-team', auth: 'admin' },
];

const SKIPPED_ROUTES: Array<{ path: string; reason: string }> = [
  { path: '/blog/:articleId', reason: 'Requires a real article slug' },
  { path: '/blog/author/:authorId', reason: 'Requires a real author identifier' },
  { path: '/blog/category/:categoryId', reason: 'Requires a real category identifier' },
  { path: '/invite/:token', reason: 'Requires a valid invite token' },
  { path: '/item/:slug', reason: 'Requires a catalog slug beyond the default fixture' },
  { path: '/reserve/:reservationId', reason: 'Requires a real reservation identifier' },
  { path: '/reserve/r/:slug', reason: 'Captured for default slug only' },
];

type CaptureStatus =
  | { status: 'captured'; path: string; label: string; screenshot: string; finalUrl: string; auth?: 'user' | 'admin' }
  | { status: 'skipped'; path: string; reason: string }
  | { status: 'error'; path: string; label: string; auth?: 'user' | 'admin'; message: string; finalUrl?: string };

function ensureOutputDirectory(): void {
  mkdirSync(outputDir, { recursive: true });
}

function appendSkippedRoutes(manifest: CaptureStatus[]) {
  for (const skipped of SKIPPED_ROUTES) {
    manifest.push({ status: 'skipped', path: skipped.path, reason: skipped.reason });
  }
}

async function createBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 1280, height: 720 } });
}

async function loginIfNeeded(page: Page, role: 'user' | 'admin'): Promise<void> {
  if (!SNAPSHOT_EMAIL || !SNAPSHOT_PASSWORD) {
    throw new Error(`Missing credentials for ${role} routes. Set ROUTE_SNAPSHOT_EMAIL and ROUTE_SNAPSHOT_PASSWORD.`);
  }

  await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: /password/i }).click();
  await page.getByLabel('Email address').fill(SNAPSHOT_EMAIL);
  await page.getByLabel('Password').fill(SNAPSHOT_PASSWORD);
  await page.getByRole('button', { name: /sign in with password/i }).click();

  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  const currentUrl = page.url();
  if (new URL(currentUrl).pathname.startsWith('/signin')) {
    throw new Error('Authentication did not complete: still on /signin after attempting login');
  }
}

async function captureRoute(page: Page, route: (typeof ROUTES)[number]): Promise<CaptureStatus> {
  const targetUrl = `${BASE_URL}${route.path}`;
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    // Allow client components to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    if (route.waitFor) {
      await page.waitForSelector(route.waitFor, { timeout: 10000 });
    }
    await page.waitForTimeout(500);
    const finalUrl = page.url();
    const filename = `${route.label.replace(/[^a-z0-9-_]+/gi, '-') || basename(route.path)}.png`;
    const screenshotPath = join(outputDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return { status: 'captured', path: route.path, label: route.label, screenshot: screenshotPath, finalUrl, auth: route.auth };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', path: route.path, label: route.label, auth: route.auth, message };
  }
}

async function run(): Promise<void> {
  ensureOutputDirectory();
  const manifest: CaptureStatus[] = [];
  const browser = await createBrowser();

  try {
    const publicContext = await createContext(browser);
    const publicPage = await publicContext.newPage();

    for (const route of ROUTES.filter((r) => !r.auth)) {
      manifest.push(await captureRoute(publicPage, route));
    }

    await publicContext.close();

    if (ROUTES.some((route) => route.auth === 'user')) {
    const userContext = await createContext(browser);
    const userPage = await userContext.newPage();
    try {
      await loginIfNeeded(userPage, 'user');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const route of ROUTES.filter((r) => r.auth === 'user')) {
        manifest.push({ status: 'error', path: route.path, label: route.label, auth: route.auth, message });
      }
      await userContext.close();
      console.error('[capture-route-screenshots] User login failed:', message);
      if (ROUTES.some((r) => r.auth === 'admin')) {
        // Also populate admin routes if they rely on the same credentials
        for (const route of ROUTES.filter((r) => r.auth === 'admin')) {
          manifest.push({ status: 'error', path: route.path, label: route.label, auth: route.auth, message });
        }
      }
      appendSkippedRoutes(manifest);
      finalize(manifest);
      return;
    }

    for (const route of ROUTES.filter((r) => r.auth === 'user')) {
      manifest.push(await captureRoute(userPage, route));
    }

      await userContext.close();
    }

    if (ROUTES.some((route) => route.auth === 'admin')) {
    const adminContext = await createContext(browser);
    const adminPage = await adminContext.newPage();
    try {
      await loginIfNeeded(adminPage, 'admin');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const route of ROUTES.filter((r) => r.auth === 'admin')) {
        manifest.push({ status: 'error', path: route.path, label: route.label, auth: route.auth, message });
      }
      await adminContext.close();
      console.error('[capture-route-screenshots] Admin login failed:', message);
      appendSkippedRoutes(manifest);
      finalize(manifest);
      return;
    }

    for (const route of ROUTES.filter((r) => r.auth === 'admin')) {
      manifest.push(await captureRoute(adminPage, route));
    }

      await adminContext.close();
    }

    appendSkippedRoutes(manifest);

    finalize(manifest);
  } finally {
    await browser.close();
  }
}

function finalize(manifest: CaptureStatus[]) {
  const manifestPath = join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  const summaryLines = manifest.map((entry) => {
    if (entry.status === 'captured') {
      return `- ✅ ${entry.path} → ${entry.screenshot}`;
    }
    if (entry.status === 'skipped') {
      return `- ⚠️ ${entry.path} (skipped: ${entry.reason})`;
    }
    return `- ❌ ${entry.path} (error: ${entry.message})`;
  });

  const summaryPath = join(outputDir, 'SUMMARY.md');
  const header = `# Route screenshot summary (generated ${timestamp})\n\nBase URL: ${BASE_URL}\n\n`;
  writeFileSync(summaryPath, `${header}${summaryLines.join('\n')}\n`, 'utf-8');

  console.log(`[capture-route-screenshots] Summary written to ${summaryPath}`);
  return manifest;
}
run().catch((error) => {
  console.error('[capture-route-screenshots] Failed:', error);
  process.exitCode = 1;
});
