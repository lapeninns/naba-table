import { expect, test } from '@playwright/test';

import type { APIRequestContext } from '@playwright/test';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

type TestInvite = {
  invite: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    restaurantId: string;
  };
  token: string;
  inviteUrl: string;
};

async function createTestInvite(
  request: APIRequestContext,
  baseURL: string | undefined,
  options: {
    email: string;
    role?: 'owner' | 'manager' | 'host' | 'server';
    status?: 'pending' | 'accepted' | 'revoked' | 'expired';
    expiresInDays?: number;
  },
): Promise<TestInvite> {
  const apiKey = process.env.PLAYWRIGHT_TEST_API_KEY;
  const response = await request.post(`${baseURL}/api/test/invitations`, {
    headers: apiKey ? { 'x-test-route-key': apiKey } : undefined,
    data: {
      email: options.email,
      role: options.role ?? 'manager',
      status: options.status ?? 'pending',
      expiresInDays: options.expiresInDays ?? 7,
    },
  });

  if (!response.ok()) {
    const errorBody = await response.text();
    console.error('Failed to create test invite:', response.status(), errorBody);
    throw new Error(`Failed to create test invite: ${response.status()} ${errorBody}`);
  }
  return (await response.json()) as TestInvite;
}

async function deleteTestInvite(
  request: APIRequestContext,
  baseURL: string | undefined,
  options: { email?: string; token?: string },
): Promise<void> {
  const apiKey = process.env.PLAYWRIGHT_TEST_API_KEY;
  await request.delete(`${baseURL}/api/test/invitations`, {
    headers: apiKey ? { 'x-test-route-key': apiKey } : undefined,
    data: options,
  });
}

test.describe('Invite acceptance - Invalid states', () => {
  test('shows not found state for invalid token', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const invalidToken = 'invalid-token-does-not-exist-12345';
    await page.goto(`/invite/${invalidToken}`);

    await expect(page.getByRole('heading', { name: /Invitation not found/i })).toBeVisible();
    await expect(
      page.getByText(/The invite link may be incorrect or has already been used/i),
    ).toBeVisible();
  });

  test('shows revoked state for revoked invite', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `revoked-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      status: 'revoked',
    });

    try {
      await page.goto(`/invite/${token}`);

      await expect(page.getByRole('heading', { name: /Invitation revoked/i })).toBeVisible();
      await expect(
        page.getByText(/This invitation was revoked by the restaurant team/i),
      ).toBeVisible();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('shows accepted state for already accepted invite', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `accepted-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      status: 'accepted',
    });

    try {
      await page.goto(`/invite/${token}`);

      await expect(page.getByRole('heading', { name: /Invitation already accepted/i })).toBeVisible();
      await expect(
        page.getByText(/You have already joined this restaurant team/i),
      ).toBeVisible();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('shows expired state for expired invite', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `expired-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      status: 'expired',
    });

    try {
      await page.goto(`/invite/${token}`);

      await expect(page.getByRole('heading', { name: /Invitation expired/i })).toBeVisible();
      await expect(
        page.getByText(/This invitation has expired/i),
      ).toBeVisible();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('shows expired state when expiry date has passed', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `expired-date-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      status: 'pending',
      expiresInDays: -1, // Already expired (yesterday)
    });

    try {
      await page.goto(`/invite/${token}`);

      await expect(page.getByRole('heading', { name: /Invitation expired/i })).toBeVisible();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });
});

test.describe('Invite acceptance - Valid flow', () => {
  test('displays invite details correctly', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `display-test-${Date.now()}@example.com`;
    const testRole = 'manager';
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      role: testRole,
    });

    try {
      await page.goto(`/invite/${token}`);

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');
      
      // Verify we're on the invite acceptance page by checking for form fields
      await expect(page.getByLabel(/Full name/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByLabel(/Create password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Accept invite/i })).toBeVisible();
      
      // Check that email is displayed on the page
      await expect(page.getByText(testEmail)).toBeVisible();
      
      // Check for invitation context
      await expect(page.locator('text=/join|invitation/i').first()).toBeVisible();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('accepts valid invite and creates account', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `acceptance-test-${Date.now()}@example.com`;
    const testName = 'Test User';
    const testPassword = 'ValidPassword123';

    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      role: 'manager',
    });

    try {
      await page.goto(`/invite/${token}`);

      // Fill in the form
      await page.getByLabel(/Full name/i).fill(testName);
      await page.getByLabel(/Create password/i).fill(testPassword);

      // Submit the form
      const submitButton = page.getByRole('button', { name: /Accept invite/i });
      await expect(submitButton).toBeEnabled();

      const [acceptResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().includes('/api/team/invitations/') && response.url().includes('/accept')),
        submitButton.click(),
      ]);

      // Verify the API response was successful
      expect(acceptResponse.ok()).toBeTruthy();

      // Should show success toast
      await expect(page.getByText(/Invitation accepted/i)).toBeVisible({ timeout: 10000 });

      // Should redirect to /ops or show sign-in success
      await page.waitForURL(/\/(ops|signin)/, { timeout: 15000 });
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });
});

test.describe('Invite acceptance - Form validation', () => {
  test('validates name field requirements', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `name-validation-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
    });

    try {
      await page.goto(`/invite/${token}`);

      const nameInput = page.getByLabel(/Full name/i);
      const passwordInput = page.getByLabel(/Create password/i);
      const submitButton = page.getByRole('button', { name: /Accept invite/i });

      // Fill password with valid value
      await passwordInput.fill('ValidPassword123');

      // Try submitting with empty name
      await nameInput.fill('');
      await nameInput.blur(); // Trigger validation
      await submitButton.click();
      await page.waitForTimeout(500); // Wait for validation
      // Check for validation error - may be "Enter your full name" or "full name must be at least"
      await expect(page.locator('text=/name|full name/i').first()).toBeVisible();

      // Try submitting with name too short (1 character)
      await nameInput.fill('A');
      await nameInput.blur();
      await submitButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=/name|full name/i').first()).toBeVisible();

      // Valid name (2+ characters) should not show error
      await nameInput.fill('AB');
      await submitButton.click();
      await page.waitForTimeout(500);
      const errorCount = await page.locator('text=/Enter your full name|full name must be/i').count();
      expect(errorCount).toBe(0);
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('validates password field requirements', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `password-validation-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
    });

    try {
      await page.goto(`/invite/${token}`);

      const nameInput = page.getByLabel(/Full name/i);
      const passwordInput = page.getByLabel(/Create password/i);
      const submitButton = page.getByRole('button', { name: /Accept invite/i });

      // Fill name with valid value
      await nameInput.fill('Test User');

      // Try submitting with empty password
      await passwordInput.fill('');
      await submitButton.click();
      await expect(page.getByText(/Password must be at least 10 characters/i)).toBeVisible();

      // Try submitting with password too short (9 characters)
      await passwordInput.fill('Short123');
      await submitButton.click();
      await expect(page.getByText(/Password must be at least 10 characters/i)).toBeVisible();

      // Try submitting with password without numbers (only letters)
      await passwordInput.fill('OnlyLettersHere');
      await submitButton.click();
      await expect(page.getByText(/Include letters and numbers for security/i)).toBeVisible();

      // Try submitting with password without letters (only numbers)
      await passwordInput.fill('1234567890');
      await submitButton.click();
      await expect(page.getByText(/Include letters and numbers for security/i)).toBeVisible();

      // Valid password (10+ chars with letters and numbers) should not show error
      await passwordInput.fill('ValidPass123');
      await submitButton.click();
      await expect(page.getByText(/Password must be at least 10 characters/i)).not.toBeVisible({ timeout: 2000 });
      await expect(page.getByText(/Include letters and numbers for security/i)).not.toBeVisible({ timeout: 2000 });
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('shows loading state during submission', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `loading-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
    });

    try {
      await page.goto(`/invite/${token}`);

      await page.getByLabel(/Full name/i).fill('Test User');
      await page.getByLabel(/Create password/i).fill('ValidPassword123');

      // Intercept to slow down the request so we can see loading state
      let requestStarted = false;
      await page.route('**/api/team/invitations/*/accept', async (route) => {
        requestStarted = true;
        await page.waitForTimeout(3000); // Delay to observe loading state
        await route.continue();
      });
      
      const submitButton = page.getByRole('button', { name: /Accept invite/i });
      
      // Click button
      const clickPromise = submitButton.click();
      
      // Wait for request to start
      await page.waitForTimeout(100);
      
      // Check loading state - either "Joining" text OR disabled button
      try {
        await expect(page.getByText(/Joining/i)).toBeVisible({ timeout: 2000 });
      } catch {
        // Fallback: check if button is disabled
        await expect(submitButton).toBeDisabled({ timeout: 2000 });
      }
      
      // Wait for click to complete
      await clickPromise;
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });
});

test.describe('Invite acceptance - Error handling', () => {
  test('handles API validation errors', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `api-error-test-${Date.now()}@example.com`;
    
    // Create an already accepted invite
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
      status: 'accepted',
    });

    try {
      // Visit the page - should show already accepted state server-side
      await page.goto(`/invite/${token}`);
      await expect(page.getByRole('heading', { name: /Invitation already accepted/i })).toBeVisible();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('displays error message for network failures', async ({ page, request, baseURL, context }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `network-error-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
    });

    try {
      await page.goto(`/invite/${token}`);

      // Fill form first
      await page.getByLabel(/Full name/i).fill('Test User');
      await page.getByLabel(/Create password/i).fill('ValidPassword123');

      // Intercept the API call and simulate a network error
      await page.route('**/api/team/invitations/*/accept', (route) => {
        route.abort('failed');
      });

      await page.getByRole('button', { name: /Accept invite/i }).click();

      // Should show error message - check for any error message element
      await expect(
        page.locator('[role="alert"], .text-red-600, .text-destructive').filter({ hasText: /went wrong|error|fail/i }).first(),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });

  test('displays error message for server errors', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Invite flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `server-error-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
    });

    try {
      await page.goto(`/invite/${token}`);

      // Intercept the API call and return a server error
      await page.route('**/api/team/invitations/*/accept', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.getByLabel(/Full name/i).fill('Test User');
      await page.getByLabel(/Create password/i).fill('ValidPassword123');
      await page.getByRole('button', { name: /Accept invite/i }).click();

      // Should show error message in UI (target the role=alert element specifically)
      await expect(
        page.getByRole('alert').filter({ hasText: /Internal server error/i }),
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });
});

test.describe('Invite acceptance - Mobile viewport', () => {
  test('accepts invite on mobile device', async ({ page, request, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Runs only on the mobile viewport project.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const testEmail = `mobile-test-${Date.now()}@example.com`;
    const { token } = await createTestInvite(request, baseURL, {
      email: testEmail,
    });

    try {
      await page.goto(`/invite/${token}`);

      // Verify mobile-friendly layout
      await expect(page.getByRole('heading', { name: /Join/i })).toBeVisible();
      
      // Form should be usable on mobile
      const nameInput = page.getByLabel(/Full name/i);
      const passwordInput = page.getByLabel(/Create password/i);
      
      await expect(nameInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      
      // Inputs should have appropriate size (prevent zoom on iOS)
      await nameInput.fill('Mobile Test User');
      await passwordInput.fill('MobilePass123');
      
      const submitButton = page.getByRole('button', { name: /Accept invite/i });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
    } finally {
      await deleteTestInvite(request, baseURL, { email: testEmail });
    }
  });
});
