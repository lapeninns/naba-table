import type { Locator, Page } from '@playwright/test';

export const wizardSelectors = {
  planHeading: (page: Page): Locator => page.getByRole('heading', { name: /Plan your visit/i }),
  datePickerTrigger: (page: Page): Locator => page.getByRole('button', { name: /^Date$/i }),
  continueButton: (page: Page): Locator => page.getByRole('button', { name: /^Continue$/i }),
  confirmButton: (page: Page): Locator => page.getByRole('button', { name: /Confirm booking/i }),
  contactHeading: (page: Page): Locator => page.getByRole('heading', { name: /Tell us how to reach you/i }),
};

export const profileSelectors = {
  uploadInput: (page: Page): Locator => page.locator('input[type="file"]'),
  saveButton: (page: Page): Locator => page.getByRole('button', { name: /Save changes/i }),
  statusToast: (page: Page): Locator => page.getByRole('status'),
};

export const pricingSelectors = {
  planButton: (page: Page, name: string): Locator => page.getByRole('button', { name: new RegExp(name, 'i') }),
};
