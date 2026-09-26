import { expect, test } from '@playwright/test';

import {
  appHostBaseUrl,
  installCommandCenterApiMocks,
  qaAuthCookieName,
  qaAuthCookieValue,
} from './helpers/restaurant-settings-api-mocks';

test.describe('ops restaurant settings command-center primary routes', () => {
  test.use({ baseURL: appHostBaseUrl, viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: qaAuthCookieName,
        value: qaAuthCookieValue,
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await installCommandCenterApiMocks(page);
  });

  test('index route renders the setup overview @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant$/);
    await expect(page.getByRole('heading', { name: 'Restaurant setup' })).toBeVisible();
    const main = page.locator('main');
    await expect(main.getByRole('region', { name: 'Ready to take bookings' })).toBeVisible();
    await expect(main.getByRole('img', { name: '3 of 3 required steps complete' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Preview guest times' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability',
    );
    const required = main.getByRole('region', { name: 'Required before guests can book' });
    await expect(required.getByText('7 days open each week')).toBeVisible();
    await expect(required.getByText('14 meal times set')).toBeVisible();
    await expect(required.getByText('2 tables added')).toBeVisible();
    await expect(required.getByText('2 bookable now')).toBeVisible();
    await expect(
      main.getByRole('region', { name: 'Optional' }).getByText('1 pending invite.'),
    ).toBeVisible();
    await expect(main.getByText('Setup flow')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open availability' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability#weekly-hours',
    );
    await expect(page.getByRole('link', { name: 'Open tables' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/tables',
    );

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-setup-overview-desktop.png'),
      fullPage: true,
    });
  });

  test('index route keeps the setup overview usable at tablet width @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/settings/restaurant', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page.getByRole('navigation', { name: 'Restaurant settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Restaurant profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Restaurant setup' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open availability' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open tables' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-setup-overview-tablet.png'),
      fullPage: true,
    });
  });

  test('discovery route shows GBP-aware disconnected status @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/discovery', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/discovery/);
    await expect(page.getByRole('heading', { name: 'Discovery details' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Categories' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Link Google Business Profile' }).first(),
    ).toHaveAttribute('href', '/app/settings/restaurant/google-business-profile#gbp-connection');
    await expect(page.locator('main').getByText('Not compared with Google.').first()).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-discovery-gbp-disconnected.png'),
      fullPage: true,
    });
  });

  test('profile route offers a clean-state GBP link action @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/profile/);
    await expect(page.getByRole('heading', { name: 'Restaurant profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Link Google Business Profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-profile-gbp-link-action.png'),
      fullPage: true,
    });
  });

  test('menu route renders the menu command center @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/menu/);
    await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
    const catalogues = page.getByRole('navigation', { name: 'Menu catalogues' });
    await expect(catalogues.getByRole('link', { name: 'Food menus' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(catalogues.getByRole('link', { name: 'Drinks and bar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New menu' })).toBeVisible();
    await expect(page.locator('main').getByText('No menus yet')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-menu-command-center-desktop.png'),
      fullPage: true,
    });
  });

  test('availability route renders the single-page editor @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/availability#availability-schedule', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/availability/);
    await expect(page.getByRole('heading', { name: 'Availability & Booking types' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections on this page' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weekly hours and meal times' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Special dates' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Booking rules' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Booking types and table times' }),
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-availability-schedule-desktop.png'),
      fullPage: true,
    });
  });
});
