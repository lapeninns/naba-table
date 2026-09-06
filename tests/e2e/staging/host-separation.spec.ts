import { stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();

test.describe('public/ops host separation', () => {
  test('public host serves the guest booking entry for the synthetic tenant @staging @p0', async ({
    page,
  }) => {
    // src/app/(public)/(marketing)/restaurants/[slug]/book is the guest booking entry.
    const response = await page.goto(
      `${staging.publicUrl}/restaurants/${staging.tenantA.slug}/book`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(response?.status()).toBeLessThan(400);
    expect(new URL(page.url()).origin).toBe(staging.publicUrl);
  });

  test('ops host redirects unauthenticated dashboard access to ops sign-in @staging @p0 @security', async ({
    page,
  }) => {
    // src/proxy.ts: protected restaurant pages 307 to /auth/signin?redirectedFrom=...
    await page.goto(`${staging.opsUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/auth\/signin/u, { timeout: 20_000, waitUntil: 'domcontentloaded' });
    const url = new URL(page.url());
    expect(url.origin).toBe(staging.opsUrl);
    expect(url.pathname).toBe('/auth/signin');
  });

  test('public host never renders the ops dashboard @staging @p0 @security', async ({ page }) => {
    const response = await page.goto(`${staging.publicUrl}/dashboard`, {
      waitUntil: 'domcontentloaded',
    });
    const url = new URL(page.url());
    const servedOpsDashboard =
      url.origin === staging.publicUrl &&
      url.pathname === '/dashboard' &&
      (response?.status() ?? 500) < 400;
    expect(servedOpsDashboard).toBe(false);
    await expect(page.getByRole('heading', { name: /today.?s bookings/iu })).toHaveCount(0);
  });

  test('ops-only API routes are unauthorized on both hosts without a session @staging @security', async ({
    request,
  }) => {
    // /api/ops/* is auth-guarded by the proxy on the app host and on the root host.
    for (const origin of [staging.publicUrl, staging.opsUrl]) {
      const response = await request.get(
        `${origin}/api/ops/bookings?restaurantId=${staging.tenantA.id}`,
        { failOnStatusCode: false },
      );
      expect([401, 403]).toContain(response.status());
    }
  });
});
