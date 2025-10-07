import { expect, test } from '@playwright/test';
import { wizardSelectors } from '../../helpers/selectors';

const reserveFlag = process.env.NEXT_PUBLIC_RESERVE_V2;

test.describe('customer reservation flow', () => {
  test.skip(
    reserveFlag !== 'true',
    'NEXT_PUBLIC_RESERVE_V2 must be true to render the React-based booking wizard.',
  );

  test('completes booking end-to-end for a live restaurant', async ({ page, request, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantResponse = await request.get('/api/restaurants');
    expect(restaurantResponse.ok()).toBeTruthy();

    const payload = await restaurantResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    test.skip(restaurants.length === 0, 'Requires at least one restaurant in Supabase.');

    const { slug, name: restaurantName } = restaurants[0] ?? {};
    test.skip(!slug, 'Restaurant slug required to run booking flow.');

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const dataDayAttr = targetDate.toLocaleDateString('en-US');
    const bookingName = `Playwright Guest ${Date.now()}`;
    const bookingEmail = `playwright+${Date.now()}@example.com`;

    await page.goto(`/reserve/r/${slug}`);
    await expect(wizardSelectors.planHeading(page)).toBeVisible();

    await page.getByLabel('Date').click();
    const calendarCell = page.locator(`[data-day="${dataDayAttr}"]`).first();
    await expect(calendarCell).toBeVisible();
    await calendarCell.click();

    await page.getByLabel('Time').fill('19:00');
    await page.getByLabel('Increase guests').click();

    await wizardSelectors.continueButton(page).click();
    await expect(wizardSelectors.contactHeading(page)).toBeVisible();

    await page.getByLabel('Full name').fill(bookingName);
    await page.getByLabel('Email address').fill(bookingEmail);
    await page.getByLabel('UK phone number').fill('07123 456780');
    await page.getByLabel(/I agree to the terms and privacy notice/i).check();

    await page.getByRole('button', { name: /Review booking/i }).click();
    await expect(page.getByRole('heading', { name: /Review and confirm/i })).toBeVisible();

    await wizardSelectors.confirmButton(page).click();

    await expect(page.getByRole('heading', { name: /Booking confirmed/i })).toBeVisible();
    await expect(page.getByText(bookingName, { exact: false })).toBeVisible();
    await expect(page.getByText(restaurantName ?? '', { exact: false })).toBeVisible();
  });
});
