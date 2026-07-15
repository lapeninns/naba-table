import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { clickClientControl } from './helpers/booking-wizard-assertions';
import {
  bookingFixture,
  installBookingWizardMocks,
  seedBookingWizardDraft,
  type BookingCreateMode,
} from './helpers/booking-wizard-fixtures';

const evidenceDir = process.env.BOOKING_WIZARD_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('BOOKING_WIZARD_EVIDENCE_DIR is required');

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(evidenceDir, `${testInfo.project.name || 'chromium'}-${name}.png`),
  });
}

async function openPlan(page: Page, mode: BookingCreateMode): Promise<void> {
  await installBookingWizardMocks(page, { mode });
  await seedBookingWizardDraft(page);
  await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book`);
  await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
}

async function openReview(page: Page, mode: BookingCreateMode): Promise<void> {
  await openPlan(page, mode);
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));
  await page.getByLabel('Full name').fill('QA Guest');
  await page.getByLabel('Email address').fill('qa.guest@example.test');
  await page.getByRole('checkbox', { name: /I agree to the terms/i }).check();
  await clickClientControl(page.getByTestId('wizard-action-details-review'));
  await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
}

test.use({ baseURL: 'http://localhost:5280', viewport: { width: 375, height: 812 } });
test.beforeAll(async () => mkdir(evidenceDir, { recursive: true }));

test('captures loading, offline recovery, and empty availability', async ({ page }, testInfo) => {
  await installBookingWizardMocks(page, { mode: 'success', scheduleDelayMs: 3_000 });
  await seedBookingWizardDraft(page);
  await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book`);
  await expect(page.locator('[data-slot="calendar-time-field"]')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await capture(page, testInfo, 'guest-loading-375x812');
  await expect(page.locator('[data-slot="calendar-time-field"]')).toHaveAttribute(
    'aria-busy',
    'false',
  );

  await page.context().setOffline(true);
  await expect(page.getByText('You’re offline', { exact: true })).toBeVisible();
  await capture(page, testInfo, 'guest-offline-375x812');
  await page.context().setOffline(false);
  await expect(page.getByText('You’re offline', { exact: true })).toHaveCount(0);
  await capture(page, testInfo, 'guest-online-recovery-375x812');

  await page.unrouteAll({ behavior: 'wait' });
  await installBookingWizardMocks(page, { mode: 'success', emptySchedule: true });
  await page.reload();
  const emptyMessage = page
    .getByText('All reservation times are taken on this date. Please choose a different day.', {
      exact: true,
    })
    .filter({ visible: true })
    .first();
  await expect(emptyMessage).toBeVisible();
  await page.locator('[data-plan-field="time"]').scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'guest-empty-375x812');
});

test('captures Details validation', async ({ page }, testInfo) => {
  await openPlan(page, 'success');
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));
  await page.getByLabel('Full name').fill('A');
  await page.getByLabel('Full name').blur();
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Email address').blur();
  await expect(page.getByText('Please enter at least two characters.')).toBeVisible();
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  await capture(page, testInfo, 'guest-validation-375x812');
});

test('captures safe server error', async ({ page }, testInfo) => {
  await openReview(page, 'server-error');
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
  await expect(page.getByText('Booking could not be completed.')).toBeVisible();
  await capture(page, testInfo, 'guest-server-error-375x812');
});

test('captures capacity alternatives and recovery to Plan', async ({ page }, testInfo) => {
  await openReview(page, 'capacity');
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
  await expect(page.getByText('Nearby availability')).toBeVisible();
  const alternative = page.getByRole('button', { name: '13:00' });
  await expect(alternative).toBeVisible();
  await alternative.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'guest-capacity-alternative-375x812');
  await alternative.click();
  await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Time' })).toContainText('1:00 PM');
  await capture(page, testInfo, 'guest-capacity-recovery-375x812');
});
