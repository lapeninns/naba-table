import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'nabatable:onboarding:draft:v1';

const seededState = {
  step: 6,
  restaurantId: '11111111-1111-4111-8111-111111111111',
  account: {
    email: 'owner@example.com',
    mode: 'magic_link',
  },
  profile: {
    name: 'QA Onboarding Pub',
    slug: 'qa-onboarding-pub',
    timezone: 'Europe/London',
    contactEmail: 'owner@example.com',
    contactPhone: '',
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 120,
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
  },
  operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: dayOfWeek === 1 ? '12:00' : null,
    closesAt: dayOfWeek === 1 ? '22:00' : null,
    isClosed: dayOfWeek !== 1,
    notes: null,
  })),
  servicePeriods: [
    {
      name: 'Dinner',
      dayOfWeek: null,
      startTime: '17:00',
      endTime: '21:00',
      bookingOption: 'dinner',
    },
  ],
  zones: [{ id: 'zone-1', name: 'Dining', areaType: 'indoor' }],
  tables: [{ tableNumber: '1', capacity: 2, zoneId: 'zone-1' }],
  loading: false,
  error: null,
};

test.describe('onboarding routes', () => {
  test('public onboarding entry renders the account step at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/onboarding');

    await expect(
      page.getByRole('heading', { name: 'Launch your restaurant in minutes' }),
    ).toBeVisible();
    await expect(page.locator('main').getByText('Step 1 of 6').first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(horizontalOverflow).toBe(false);
  });

  test('@p2 @browser @contract @local-only keeps account field validation on onboarding', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    await page.getByRole('combobox', { name: 'Sign-up method' }).click();
    await page.getByRole('option', { name: 'Magic link' }).click();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByRole('textbox', { name: 'Email' }).fill('not-an-email');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test('@p2 @browser @api @security @contract @local-only keeps existing-account signup failures on onboarding', async ({
    page,
  }) => {
    let signupRequests = 0;
    await page.route('**/api/auth/signup', async (route) => {
      signupRequests += 1;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'ACCOUNT_EXISTS',
          message: 'An account already exists for this email.',
          details: { field: 'email' },
        }),
      });
    });

    await page.goto('/onboarding');
    await page.getByRole('combobox', { name: 'Sign-up method' }).click();
    await page.getByRole('option', { name: 'Email & password' }).click();

    await page.getByRole('textbox', { name: 'Email' }).fill('owner@example.com');
    await page.getByLabel('Password').fill('Correct horse battery staple 1');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect.poll(() => signupRequests).toBe(1);
    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(page.getByText('An account already exists for this email.')).toBeVisible();
    await expect(page.locator('main').getByText('Step 1 of 6').first()).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test('locked legacy onboarding wrapper routes fall back to the account step', async ({
    page,
  }) => {
    await page.goto('/onboarding/profile');

    await expect(page.locator('main').getByText('Step 1 of 6').first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
  });

  test('seeded onboarding wrapper routes render the requested shipped steps', async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => {
        window.sessionStorage.setItem(key, JSON.stringify(value));
      },
      { key: STORAGE_KEY, value: seededState },
    );

    const routes = [
      ['/onboarding/profile', 'Profile'],
      ['/onboarding/hours', 'Hours'],
      ['/onboarding/services', 'Services'],
      ['/onboarding/tables', 'Tables'],
      ['/onboarding/review', 'Review'],
    ] as const;

    for (const [path, label] of routes) {
      await page.goto(path);
      await expect(page.getByText(`Current task`, { exact: true })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Launch your restaurant in minutes' }),
      ).toBeVisible();
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });
});
