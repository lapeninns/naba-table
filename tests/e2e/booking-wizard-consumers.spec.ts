import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { clickClientControl } from './helpers/booking-wizard-assertions';
import {
  bookingFixture,
  installBookingWizardMocks,
  seedBookingWizardDraft,
} from './helpers/booking-wizard-fixtures';

const evidenceDir = process.env.BOOKING_WIZARD_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('BOOKING_WIZARD_EVIDENCE_DIR is required');

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(evidenceDir, `${testInfo.project.name || 'chromium'}-${name}.png`),
  });
}

test.beforeAll(async () => mkdir(evidenceDir, { recursive: true }));

for (const colorScheme of ['light', 'dark'] as const) {
  test(`standalone Reserve renders ${colorScheme} guest surface`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme });
    await installBookingWizardMocks(page, { mode: 'success' });
    await seedBookingWizardDraft(page);
    await page.goto(`http://localhost:5274/r/${bookingFixture.restaurantSlug}`);
    await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increase guests' })).toBeVisible();
    await capture(page, testInfo, `reserve-${colorScheme}-375x812`);
  });
}

test('dev ops consumer reaches terminal Confirmation in dense surface', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await installBookingWizardMocks(page, { mode: 'success' });
  await page.goto(
    `http://localhost:5280/dev/ops-new-booking?date=${bookingFixture.date}&time=${bookingFixture.time}&partySize=2`,
  );
  await expect(page.getByRole('heading', { name: 'New booking (dev)' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Plan your table' })).toBeVisible();
  await capture(page, testInfo, 'ops-dev-plan-768x1024');
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));
  await page.getByLabel('Full name').fill('QA Ops Guest');
  await page.getByLabel('Email address (optional)').fill('qa.ops.guest@example.test');
  await clickClientControl(page.getByTestId('wizard-action-details-review'));
  await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
  await page.waitForTimeout(1_000);
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  await capture(page, testInfo, 'ops-dev-confirmation-768x1024');
});
