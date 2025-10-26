import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export async function expectPageAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}
