import path from 'node:path';

import { expect, test } from '../../fixtures/auth';
import { profileSelectors } from '../../helpers/selectors';

const avatarFixture = path.resolve(__dirname, '../../assets/avatar.png');

test.describe('profile avatar upload', () => {
  test('uploads avatar and shows success toast', async ({ authedPage }) => {
    await authedPage.goto('/profile/manage');
    await profileSelectors.uploadInput(authedPage).setInputFiles(avatarFixture);
    await profileSelectors.saveButton(authedPage).click();
    await expect(profileSelectors.statusToast(authedPage)).toContainText(/profile updated/i);
  });

  test('shows inline error when avatar upload fails', async ({ authedPage }) => {
    await authedPage.route('**/api/profile/image', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'UPLOAD_FAILED',
          message: 'We could not upload your avatar',
        }),
      });
    });

    try {
      await authedPage.goto('/profile/manage');
      await profileSelectors.uploadInput(authedPage).setInputFiles(avatarFixture);

      const errorMessage = authedPage.getByRole('alert', { name: /couldn’t upload your image/i });
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
    } finally {
      await authedPage.unroute('**/api/profile/image');
    }
  });

  test('allows submitting profile with keyboard only', async ({ authedPage }) => {
    await authedPage.goto('/profile/manage');

    const nameInput = authedPage.getByLabel('Display name');
    const phoneInput = authedPage.getByLabel('Phone');
    const emailInput = authedPage.getByLabel('Email');

    const originalName = await nameInput.inputValue();
    const originalPhone = await phoneInput.inputValue();
    const originalEmail = await emailInput.inputValue();
    const createdAt = new Date().toISOString();
    let submissionCount = 0;

    await authedPage.route('**/api/profile', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.fallback();
        return;
      }

      submissionCount += 1;
      const payload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;

      const responseProfile = {
        id: 'playwright-profile',
        email: originalEmail,
        name: typeof payload.name === 'string' ? payload.name : originalName,
        phone:
          Object.prototype.hasOwnProperty.call(payload, 'phone') && typeof payload.phone === 'string'
            ? payload.phone
            : originalPhone || null,
        image:
          Object.prototype.hasOwnProperty.call(payload, 'image') && typeof payload.image === 'string'
            ? payload.image
            : null,
        createdAt,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: responseProfile,
          idempotent: submissionCount === 2,
        }),
      });
    });

    const firstTargetName =
      originalName === 'Playwright Keyboard' ? 'Playwright Keyboard 1' : 'Playwright Keyboard';
    const secondTargetName =
      firstTargetName === 'Playwright Keyboard 1' ? 'Playwright Keyboard 2' : 'Playwright Keyboard Alt';

    try {
      await nameInput.fill(firstTargetName);
      await nameInput.press('Enter');
      await expect(authedPage.getByRole('status', { name: /profile updated/i })).toBeVisible();

      await nameInput.fill(secondTargetName);
      await nameInput.press('Enter');

      const statusRegion = authedPage
        .locator('form')
        .getByRole('status', { name: /we already saved your display name — everything is up to date\./i });
      await expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      await expect(statusRegion).toBeFocused();
    } finally {
      await authedPage.unroute('**/api/profile');
    }
  });
});
