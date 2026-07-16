import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { hideLocalDevIndicators, waitForSettledLocator } from './helpers/booking-wizard-assertions';
import {
  bookingFixture,
  installBookingWizardMocks,
  seedBookingWizardDraft,
} from './helpers/booking-wizard-fixtures';

const evidenceDir = process.env.BOOKING_WIZARD_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('BOOKING_WIZARD_EVIDENCE_DIR is required');

type FocusGeometry = {
  readonly activeName: string | null;
  readonly activeText: string;
  readonly activeBottom: number;
  readonly railTop: number;
  readonly gap: number;
};

async function readFocusGeometry(page: Page): Promise<FocusGeometry> {
  return page.evaluate(() => {
    const active = document.activeElement;
    const rail = document.querySelector('[data-booking-wizard-navigation]');
    if (!(active instanceof HTMLElement) || !(rail instanceof HTMLElement)) {
      throw new Error('Expected active control and booking rail');
    }
    const activeBox = active.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    return {
      activeName: active.getAttribute('name'),
      activeText: active.textContent?.trim() ?? '',
      activeBottom: activeBox.bottom,
      railTop: railBox.top,
      gap: railBox.top - activeBox.bottom,
    };
  });
}

test.use({ baseURL: 'http://localhost:5280', viewport: { width: 375, height: 812 } });

test('keyboard focus keeps Notes trigger and textarea above the rail', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await installBookingWizardMocks(page, { mode: 'success' });
  await seedBookingWizardDraft(page);
  await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book`);
  await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
  await page.getByRole('button', { name: 'Increase guests' }).click();

  let triggerGeometry: FocusGeometry | null = null;
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    const geometry = await readFocusGeometry(page);
    if (geometry.activeText.includes('Add dietary, access, or occasion notes')) {
      await waitForSettledLocator(page.locator(':focus'));
      triggerGeometry = await readFocusGeometry(page);
      break;
    }
  }
  expect(triggerGeometry).not.toBeNull();
  expect(triggerGeometry?.gap).toBeGreaterThanOrEqual(0);

  await page.keyboard.press('Enter');
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    if ((await readFocusGeometry(page)).activeName === 'reservation-notes') break;
  }
  await waitForSettledLocator(page.locator(':focus'));
  const textareaGeometry = await readFocusGeometry(page);
  console.log(
    `[keyboard-focus] ${JSON.stringify({ trigger: triggerGeometry, textarea: textareaGeometry })}`,
  );
  await hideLocalDevIndicators(page);
  await waitForSettledLocator(page.locator(':focus'));
  await page.screenshot({
    path: path.join(evidenceDir, 'chromium-plan-notes-keyboard-focus-375x812.png'),
  });
  expect(textareaGeometry.activeName).toBe('reservation-notes');
  expect(textareaGeometry.gap).toBeGreaterThanOrEqual(0);
});

test('Escape, reduced motion, and 320px safe-area actions remain usable', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installBookingWizardMocks(page, { mode: 'success' });
  await seedBookingWizardDraft(page);
  await page.goto(`/restaurants/${bookingFixture.restaurantSlug}/book`);
  await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Increase guests' })).toBeVisible();

  const summary = page.getByRole('button', { name: /booking summary/ });
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(summary).toHaveAttribute('aria-expanded', 'false');

  const reducedMotion = await page.evaluate(() => {
    const action = document.querySelector('[data-testid="wizard-action-plan-continue"]');
    if (!(action instanceof HTMLElement)) throw new Error('Expected Plan action');
    const style = getComputedStyle(action);
    return {
      animationDuration: Number.parseFloat(style.animationDuration),
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: Number.parseFloat(style.transitionDuration),
    };
  });
  expect(reducedMotion.matches).toBe(true);
  expect(reducedMotion.scrollBehavior).toBe('auto');
  expect(reducedMotion.animationDuration).toBeLessThanOrEqual(0.01);
  expect(reducedMotion.transitionDuration).toBeLessThanOrEqual(0.01);

  const geometry = await page.evaluate(() => {
    const rail = document.querySelector('[data-booking-wizard-navigation]');
    const action = document.querySelector('[data-testid="wizard-action-plan-continue"]');
    if (!(rail instanceof HTMLElement) || !(action instanceof HTMLElement)) {
      throw new Error('Expected rail and action');
    }
    const actionBox = action.getBoundingClientRect();
    return {
      actionBottom: actionBox.bottom,
      actionHeight: actionBox.height,
      actionLeft: actionBox.left,
      actionRight: actionBox.right,
      railClass: rail.className,
      viewportWidth: innerWidth,
    };
  });
  expect(geometry.railClass).toContain('safe-area-inset-bottom');
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.actionLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.actionRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.actionBottom).toBeLessThanOrEqual(568);
  await hideLocalDevIndicators(page);
  await waitForSettledLocator(page.getByRole('heading', { name: 'Plan your table' }));
  await page.screenshot({
    path: path.join(evidenceDir, 'chromium-plan-reduced-motion-safe-area-320x568.png'),
  });
});
