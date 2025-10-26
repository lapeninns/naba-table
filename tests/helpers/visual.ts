import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export async function expectWizardScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`wizard/${name}.png`, {
    maxDiffPixels: 200,
    animations: 'disabled',
  });
}
