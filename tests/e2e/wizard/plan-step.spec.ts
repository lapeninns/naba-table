import { expect, test } from '@playwright/test';
import { wizardSelectors } from '../../helpers/selectors';

const reserveFlag = process.env.NEXT_PUBLIC_RESERVE_V2;

test.describe('reservation wizard - plan step', () => {
  test.skip(reserveFlag !== 'true', 'NEXT_PUBLIC_RESERVE_V2 must be true to render the React Router wizard.');

  test('requires date and time before continuing @smoke', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/reserve');
    await expect(wizardSelectors.planHeading(page)).toBeVisible();

    await wizardSelectors.continueButton(page).click();
    await expect(page.getByText(/please select a date/i)).toBeVisible();

    await wizardSelectors.datePickerTrigger(page).click();
    await page.getByRole('gridcell', { name: /\b1\b/ }).first().click();
    await page.getByRole('button', { name: /12:00/i }).first().click();

    await wizardSelectors.continueButton(page).click();
    await expect(wizardSelectors.contactHeading(page)).toBeVisible();
  });
});
