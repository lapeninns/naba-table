import type { Locator, Page } from '@playwright/test';

const wizardAction = (page: Page, actionId: string): Locator =>
  page.getByTestId(`wizard-action-${actionId}`);

export const wizardSelectors = {
  planHeading: (page: Page): Locator => page.getByRole('heading', { name: /Plan your visit/i }),
  datePickerTrigger: (page: Page): Locator => page.getByRole('button', { name: /^Date$/i }),
  continueButton: (page: Page): Locator => wizardAction(page, 'plan-continue'),
  confirmButton: (page: Page): Locator => wizardAction(page, 'review-confirm'),
  contactHeading: (page: Page): Locator => page.getByRole('heading', { name: /Tell us how to reach you/i }),
};

export const profileSelectors = {
  uploadInput: (page: Page): Locator => page.locator('input[type="file"]'),
  saveButton: (page: Page): Locator => page.getByRole('button', { name: /Save changes/i }),
  statusToast: (page: Page): Locator => page.getByTestId('profile-status'),
};

export const pricingSelectors = {
  planButton: (page: Page, name: string): Locator => page.getByRole('button', { name: new RegExp(name, 'i') }),
};
