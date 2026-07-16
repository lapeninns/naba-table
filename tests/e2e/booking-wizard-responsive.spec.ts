import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  assertMinimumTarget,
  assertNoSeriousAxeViolations,
  assertNoWizardOverflow,
  assertRailGeometry,
  clickClientControl,
  hideLocalDevIndicators,
  waitForSettledLocator,
} from './helpers/booking-wizard-assertions';
import {
  bookingFixture,
  installBookingWizardMocks,
  seedBookingWizardDraft,
} from './helpers/booking-wizard-fixtures';

const appBaseUrl = `http://localhost:${process.env.QA_APP_PORT ?? '5180'}`;
const evidenceDir = process.env.BOOKING_WIZARD_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('BOOKING_WIZARD_EVIDENCE_DIR is required');

const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
  anchor: ReturnType<Page['locator']>,
): Promise<void> {
  await hideLocalDevIndicators(page);
  await waitForSettledLocator(anchor);
  await page.screenshot({
    path: path.join(evidenceDir, `${testInfo.project.name || 'chromium'}-${name}.png`),
    fullPage: false,
  });
}

async function completeDetails(page: Page): Promise<void> {
  await page.getByLabel('Full name').fill('QA Guest');
  await page.getByLabel('Email address').fill('qa.guest@example.test');
  await page.getByRole('checkbox', { name: /I agree to the terms/i }).check();
}

async function assertStep(page: Page, finalControl: ReturnType<Page['locator']>): Promise<void> {
  await assertNoWizardOverflow(page);
  await assertRailGeometry(page, finalControl);
}

test.describe('booking wizard responsive evidence matrix', () => {
  test.use({ baseURL: appBaseUrl });
  test.beforeAll(async () => mkdir(evidenceDir, { recursive: true }));

  for (const viewport of viewports) {
    test(`${viewport.name} proves shipped guest steps and independent thank-you`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await installBookingWizardMocks(page, { mode: 'success' });
      await seedBookingWizardDraft(page);
      await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book`);
      await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();

      const notes = page.getByRole('button', { name: /add dietary, access, or occasion notes/i });
      const increaseGuests = page.getByRole('button', { name: 'Increase guests' });
      await expect(increaseGuests).toBeVisible();
      await assertMinimumTarget(increaseGuests);
      await assertStep(page, notes);
      await assertNoSeriousAxeViolations(page);
      await capture(
        page,
        testInfo,
        `guest-plan-${viewport.name}`,
        page.getByRole('heading', { name: 'Plan your table' }),
      );
      console.log(`[matrix] ${viewport.name} plan`);

      await expect(page.getByRole('combobox', { name: 'Time' })).toContainText(
        bookingFixture.timeLabel,
      );
      await clickClientControl(page.getByTestId('wizard-action-plan-continue'));
      await expect(page.getByRole('heading', { name: 'Tell us how to reach you' })).toBeVisible();
      const terms = page.getByRole('checkbox', { name: /I agree to the terms/i });
      await assertStep(page, terms);
      await capture(
        page,
        testInfo,
        `guest-details-${viewport.name}`,
        page.getByRole('heading', { name: 'Tell us how to reach you' }),
      );
      console.log(`[matrix] ${viewport.name} details`);

      await completeDetails(page);
      await clickClientControl(page.getByTestId('wizard-action-details-review'));
      await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
      const editPlan = page.getByRole('button', { name: 'Edit reservation details' });
      const editGuest = page.getByRole('button', { name: 'Edit guest details' });
      await assertMinimumTarget(editPlan);
      await assertMinimumTarget(editGuest);
      await assertStep(page, editGuest);
      await capture(
        page,
        testInfo,
        `guest-review-${viewport.name}`,
        page.getByRole('heading', { name: 'Review the booking' }),
      );
      console.log(`[matrix] ${viewport.name} review`);

      await clickClientControl(page.getByTestId('wizard-action-review-confirm'));
      await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
      await expect(
        page
          .getByRole('region', { name: 'Booking reference' })
          .getByText(bookingFixture.bookingReference),
      ).toBeVisible();
      await assertStep(page, page.getByRole('button', { name: 'More actions' }));
      await waitForSettledLocator(page.getByRole('heading', { name: 'Booking confirmed' }));
      let moreActionsFocused = false;
      for (let index = 0; index < 40; index += 1) {
        await page.keyboard.press('Tab');
        moreActionsFocused = await page.evaluate(
          () => document.activeElement?.textContent?.trim() === 'More actions',
        );
        if (moreActionsFocused) break;
      }
      expect(moreActionsFocused).toBe(true);
      await waitForSettledLocator(page.locator(':focus'));
      const confirmationFocusGap = await page.evaluate(() => {
        const active = document.activeElement;
        const rail = document.querySelector('[data-booking-wizard-navigation]');
        if (!(active instanceof HTMLElement) || !(rail instanceof HTMLElement)) return null;
        return rail.getBoundingClientRect().top - active.getBoundingClientRect().bottom;
      });
      expect(confirmationFocusGap).not.toBeNull();
      expect(confirmationFocusGap ?? -1).toBeGreaterThanOrEqual(0);
      await assertNoSeriousAxeViolations(page);
      await capture(
        page,
        testInfo,
        `guest-confirmation-${viewport.name}`,
        page.getByRole('heading', { name: 'Booking confirmed' }),
      );
      console.log(`[matrix] ${viewport.name} confirmation`);
      await expect(page.getByRole('button', { name: 'Plan (1 of 4)' })).toHaveCount(0);

      await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book/thank-you`);
      await expect(page.getByRole('heading', { name: 'Your table request is in.' })).toBeVisible();
      await assertNoWizardOverflow(page);
      await assertNoSeriousAxeViolations(page);
      await capture(
        page,
        testInfo,
        `guest-thank-you-${viewport.name}`,
        page.getByRole('heading', { name: 'Your table request is in.' }),
      );
      console.log(`[matrix] ${viewport.name} thank-you`);
    });
  }
});
