import { stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();

test('unlinked Google settings render without requesting dual-sync state @staging', async ({
  page,
}) => {
  const rawCookies = staging.optional.STAGING_TENANT_B_SESSION_COOKIES;
  test.skip(!rawCookies, 'STAGING_TENANT_B_SESSION_COOKIES not provided');
  expect(staging.optional.STAGING_EMAIL_MOCK_VERIFIED).toBe('true');
  expect(staging.optional.STAGING_SMS_SINK_VERIFIED).toBe('true');
  // Runner obtains these through Supabase SSR auth.setSession with a genuine fixture session.
  // Neither the cookie values nor a storage-state artifact are logged or persisted here.
  const parsed: unknown = JSON.parse(rawCookies ?? '[]');
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error('Synthetic ops session cookies are required');
  const cookies = parsed.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('name' in entry) ||
      !('value' in entry) ||
      typeof entry.name !== 'string' ||
      typeof entry.value !== 'string' ||
      !/^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/u.test(entry.name) ||
      /[;\r\n]/u.test(entry.value)
    ) {
      throw new Error('Invalid synthetic ops session cookie shape');
    }
    return { name: entry.name, value: entry.value };
  });
  const origin = new URL(staging.opsUrl).origin;
  await page.context().addCookies(
    cookies.map((cookie) => ({
      ...cookie,
      url: origin,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax' as const,
    })),
  );
  let dualSyncRequests = 0;
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/dual-sync')) dualSyncRequests++;
  });
  page.on('pageerror', () => pageErrors.push('pageerror'));
  const response = await page.goto(
    `${origin}/settings/restaurant/google-business-profile?restaurantId=${staging.tenantB.id}`,
    { waitUntil: 'domcontentloaded' },
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Connect Google', exact: true })).toBeVisible();
  await expect(page.locator('#gbp-sync-review')).toHaveCount(0);
  expect(dualSyncRequests).toBe(0);
  expect(pageErrors).toHaveLength(0);
  await expect
    .poll(async () =>
      page.getByRole('button', { name: 'Connect Google', exact: true }).evaluate((element) => {
        for (let current: Element | null = element; current; current = current.parentElement) {
          if (Number(getComputedStyle(current).opacity) < 0.99) return false;
        }
        return true;
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: test.info().outputPath('gbp-unlinked-settings.png'),
    fullPage: true,
  });
});
