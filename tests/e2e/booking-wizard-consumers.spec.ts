import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  assertElementAboveRail,
  assertNoSeriousAxeViolations,
  assertTopCaptureFraming,
  clickClientControl,
  collectFocusedAxeColorContrast,
  hideLocalDevIndicators,
  waitForSettledAccessibilityTarget,
} from './helpers/booking-wizard-assertions';
import {
  bookingFixture,
  installBookingWizardMocks,
  seedBookingWizardDraft,
} from './helpers/booking-wizard-fixtures';

const evidenceDir = process.env.BOOKING_WIZARD_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('BOOKING_WIZARD_EVIDENCE_DIR is required');

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
  anchor: ReturnType<Page['locator']>,
  framing: 'state' | 'top',
): Promise<void> {
  await hideLocalDevIndicators(page);
  const geometry =
    framing === 'top'
      ? await assertTopCaptureFraming(page, anchor, name)
      : await assertElementAboveRail(page, anchor, name);
  console.log(`[consumer-geometry] ${JSON.stringify(geometry)}`);
  await page.screenshot({
    path: path.join(evidenceDir, `${testInfo.project.name || 'chromium'}-${name}.png`),
  });
}

test.beforeAll(async () => mkdir(evidenceDir, { recursive: true }));

async function assertSettledContrast(page: Page, locator: Locator, label: string): Promise<void> {
  const settled = await waitForSettledAccessibilityTarget(locator);
  const focused = await collectFocusedAxeColorContrast(page, locator);
  console.log(`[consumer-contrast] ${JSON.stringify({ label, settled, focused })}`);
  expect(focused.passed).toBe(true);
  expect(focused.violations).toEqual([]);
  expect(focused.incomplete).toEqual([]);
  await assertNoSeriousAxeViolations(page);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`standalone Reserve renders ${colorScheme} guest surface`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme });
    await installBookingWizardMocks(page, { mode: 'success' });
    await seedBookingWizardDraft(page);
    await page.goto(`http://localhost:5274/r/${bookingFixture.restaurantSlug}`);
    const planHeading = page.getByRole('heading', { name: 'Plan your table' });
    await expect(planHeading).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increase guests' })).toBeVisible();
    await assertSettledContrast(
      page,
      page.getByTestId('wizard-action-plan-continue').locator('span'),
      `reserve-${colorScheme}-continue`,
    );
    await capture(page, testInfo, `reserve-${colorScheme}-375x812`, planHeading, 'top');
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
  const pageHeading = page.getByRole('heading', { name: 'New booking (dev)' });
  await expect(pageHeading).toBeVisible();
  const planRegion = page.getByRole('region', { name: 'Plan your table' });
  await expect(planRegion).toBeVisible();
  await assertSettledContrast(
    page,
    page.getByText('Choose the time that works best for your party.', { exact: true }),
    'ops-time-description',
  );
  await capture(page, testInfo, 'ops-dev-plan-768x1024', pageHeading, 'top');
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));
  await page.getByLabel('Full name').fill('QA Ops Guest');
  await page.getByLabel('Email address (optional)').fill('qa.ops.guest@example.test');
  await clickClientControl(page.getByTestId('wizard-action-details-review'));
  await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
  const confirmationHeading = page.getByRole('heading', { name: 'Booking confirmed' });
  await expect(confirmationHeading).toBeVisible();
  await capture(page, testInfo, 'ops-dev-confirmation-768x1024', confirmationHeading, 'state');
});
