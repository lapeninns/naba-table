import { expect, type Locator, type Page } from '@playwright/test';
import { source as axeSource } from 'axe-core';

export async function clickClientControl(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected an HTML control');
    element.click();
  });
}

export async function assertNoWizardOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

export async function assertMinimumTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
}

export async function assertRailGeometry(page: Page, finalControl: Locator): Promise<void> {
  const rail = page.locator('[data-booking-wizard-navigation]');
  const measuredRail = page.locator('[data-wizard-navigation-rail]');
  const layout = page
    .locator('[data-booking-wizard-progress-slot]')
    .locator('xpath=ancestor::div[starts-with(normalize-space(@style),"padding-bottom")][1]');
  await expect(rail).toBeVisible();
  await expect(finalControl).toBeAttached();

  const railBox = await rail.boundingBox();
  const measuredRailBox = await measuredRail.boundingBox();
  const padding = await layout.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      bottom: Number.parseFloat(style.paddingBottom),
      scroll: Number.parseFloat(style.scrollPaddingBottom),
    };
  });

  expect(railBox).not.toBeNull();
  expect(measuredRailBox).not.toBeNull();
  expect(padding.bottom).toBeGreaterThanOrEqual(railBox?.height ?? Number.POSITIVE_INFINITY);
  expect(padding.scroll).toBeGreaterThanOrEqual(
    measuredRailBox?.height ?? Number.POSITIVE_INFINITY,
  );
}

export async function assertNoSeriousAxeViolations(page: Page): Promise<void> {
  const axeIsReady = await page.evaluate(() => typeof Reflect.get(window, 'axe') === 'object');
  if (!axeIsReady) await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axeValue = Reflect.get(window, 'axe');
    const run = Reflect.get(axeValue, 'run');
    const results = await Reflect.apply(run, axeValue, [document]);
    const findings = Reflect.get(results, 'violations');
    if (!Array.isArray(findings)) return [{ id: 'axe-result-invalid', nodes: [] }];
    return findings
      .filter((finding) => {
        const impact = Reflect.get(finding, 'impact');
        return impact === 'serious' || impact === 'critical';
      })
      .map((finding) => {
        const nodes = Reflect.get(finding, 'nodes');
        return {
          id: String(Reflect.get(finding, 'id')),
          nodes: Array.isArray(nodes)
            ? nodes.map((node) => ({
                failureSummary: String(Reflect.get(node, 'failureSummary')),
                html: String(Reflect.get(node, 'html')),
                target: Reflect.get(node, 'target'),
              }))
            : [],
        };
      });
  });
  expect(violations).toEqual([]);
}
