import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertElementAboveRail,
  assertNoSeriousAxeViolations,
  clickClientControl,
  collectFocusedAxeColorContrast,
  computeContrastEvidence,
  hideLocalDevIndicators,
  measureElementContrast,
  parseComputedColor,
} from './helpers/booking-wizard-assertions';
import {
  bookingFixture,
  installBookingWizardMocks,
  seedBookingWizardDraft,
  type BookingCreateMode,
} from './helpers/booking-wizard-fixtures';

const evidenceDir = process.env.BOOKING_WIZARD_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('BOOKING_WIZARD_EVIDENCE_DIR is required');

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
  anchor: ReturnType<Page['locator']>,
): Promise<void> {
  await hideLocalDevIndicators(page);
  const geometry = await assertElementAboveRail(page, anchor, name);
  console.log(`[state-geometry] ${JSON.stringify(geometry)}`);
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
  await clickClientControl(page.getByTestId('wizard-action-details-review'));
  await expect(page.getByRole('heading', { name: 'One last step' })).toBeVisible();
  await page.getByRole('button', { name: 'Accept all & review booking' }).click();
  await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
}

test.use({ baseURL: 'http://localhost:5280', viewport: { width: 375, height: 812 } });
test.beforeAll(async () => mkdir(evidenceDir, { recursive: true }));

test('strict contrast evidence composites alpha and rejects unresolved colors', () => {
  const evidence = computeContrastEvidence('rgb(0, 0, 0)', [
    { node: 'div', background: 'rgba(0, 0, 0, 0)', opacity: 0.5 },
    { node: 'body', background: 'rgb(255, 255, 255)', opacity: 1 },
  ]);

  expect(evidence.effectiveForeground.red).toBeCloseTo(127.5);
  expect(evidence.effectiveBackground.red).toBe(255);
  expect(evidence.ratio).toBeGreaterThan(3.9);
  expect(evidence.ratio).toBeLessThan(4);
  expect(() => parseComputedColor('color(display-p3 1 1 1)')).toThrow('Unsupported computed color');
});

test('captures loading, offline recovery, and empty availability', async ({ page }, testInfo) => {
  await installBookingWizardMocks(page, { mode: 'success', scheduleDelayMs: 3_000 });
  await seedBookingWizardDraft(page);
  await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book`);
  await expect(page.locator('[data-slot="calendar-time-field"]')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  const planHeading = page.getByRole('heading', { name: 'Plan your table' });
  await capture(page, testInfo, 'guest-loading-375x812', planHeading);
  await expect(page.locator('[data-slot="calendar-time-field"]')).toHaveAttribute(
    'aria-busy',
    'false',
  );

  await page.context().setOffline(true);
  const offlineWarning = page.getByText('You’re offline', { exact: true });
  await expect(offlineWarning).toBeVisible();
  const offlineContrast = await measureElementContrast(offlineWarning);
  const focusedAxe = await collectFocusedAxeColorContrast(page, offlineWarning);
  await writeFile(
    path.join(evidenceDir, 'offline-warning-evidence.json'),
    `${JSON.stringify({ node: 'offline-warning-title', contrast: offlineContrast, axe: focusedAxe }, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `[offline-contrast] ${JSON.stringify({
      computedForeground: offlineContrast.computedForeground,
      effectiveForeground: offlineContrast.effectiveForeground.css,
      effectiveBackground: offlineContrast.effectiveBackground.css,
      ratio: offlineContrast.ratio,
      threshold: offlineContrast.threshold,
      passed: offlineContrast.passed,
      focusedAxePassed: focusedAxe.passed,
    })}`,
  );
  expect(offlineContrast.passed).toBe(true);
  expect(focusedAxe.violations).toEqual([]);
  expect(focusedAxe.incomplete).toEqual([]);
  await assertNoSeriousAxeViolations(page);
  await capture(page, testInfo, 'guest-offline-375x812', offlineWarning);
  await page.context().setOffline(false);
  await expect(page.getByText('You’re offline', { exact: true })).toHaveCount(0);
  await capture(page, testInfo, 'guest-online-recovery-375x812', planHeading);

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
  await capture(page, testInfo, 'guest-empty-375x812', emptyMessage);
});

test('captures Details validation', async ({ page }, testInfo) => {
  await openPlan(page, 'success');
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));
  await page.getByLabel('Full name').fill('A');
  await page.getByLabel('Full name').blur();
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Email address').blur();
  await expect(page.getByText('Please enter at least two characters.')).toBeVisible();
  const emailError = page.getByText('Please enter a valid email address.');
  await expect(emailError).toBeVisible();
  await capture(page, testInfo, 'guest-validation-375x812', emailError);
});

test('captures safe server error', async ({ page }, testInfo) => {
  await openReview(page, 'server-error');
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
  const serverError = page.getByText('Booking could not be completed.').filter({ visible: true });
  await expect(serverError).toBeVisible();
  await capture(page, testInfo, 'guest-server-error-375x812', serverError);
});

test('captures capacity alternatives and recovery to Plan', async ({ page }, testInfo) => {
  await openReview(page, 'capacity');
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
  await expect(page.getByText('Nearby availability')).toBeVisible();
  const alternative = page.getByRole('button', { name: '13:00' });
  await expect(alternative).toBeVisible();
  await capture(page, testInfo, 'guest-capacity-alternative-375x812', alternative);
  await alternative.click();
  const recoveredPlanHeading = page.getByRole('heading', { name: 'Plan your table' });
  const recoveredTime = page.getByRole('combobox', { name: 'Time' });
  await expect(recoveredPlanHeading).toBeVisible();
  await expect(recoveredTime).toContainText('1:00 PM');
  await capture(page, testInfo, 'guest-capacity-recovery-375x812', recoveredTime);
});
