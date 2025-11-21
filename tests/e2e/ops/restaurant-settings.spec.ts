import { expect } from '@playwright/test';

import { test } from '../../fixtures/auth';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Ops Restaurant Settings - Restaurant Profile', () => {
  test('displays restaurant profile form', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable; skipping settings.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Check page loaded
    await expect(authedPage.getByRole('heading', { name: /Restaurant Settings/i })).toBeVisible({ timeout: 10000 });
    
    // Check Restaurant Profile section exists
    await expect(authedPage.getByText(/Restaurant Profile/i).first()).toBeVisible();
  });

  test('updates restaurant name', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Find the name input field
    const nameInput = authedPage.getByLabel(/^Name$/i).or(authedPage.getByLabel(/Restaurant name/i)).first();
    
    // Wait for form to load
    await nameInput.waitFor({ state: 'visible', timeout: 15000 });

    // Get original value
    const originalValue = await nameInput.inputValue();
    
    // Update with timestamp to make unique
    const newName = `Test Restaurant ${Date.now()}`;
    await nameInput.fill(newName);

    // Submit form
    const [response] = await Promise.all([
      authedPage.waitForResponse((resp) => 
        resp.url().includes('/api/') && 
        (resp.request().method() === 'PUT' || resp.request().method() === 'PATCH' || resp.request().method() === 'POST')
      ),
      authedPage.getByRole('button', { name: /Save|Update/i }).first().click(),
    ]);

    // Verify success
    await expect(authedPage.getByText(/updated|saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Restore original value
    if (originalValue) {
      await nameInput.fill(originalValue);
      await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();
      await authedPage.waitForTimeout(1000);
    }
  });

  test('updates restaurant timezone', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Find timezone select
    const timezoneSelect = authedPage.locator('select').filter({ hasText: /UTC|London|New York/i }).first();
    await timezoneSelect.waitFor({ state: 'visible', timeout: 15000 });

    // Get original value
    const originalValue = await timezoneSelect.inputValue();

    // Select different timezone
    await timezoneSelect.selectOption({ index: 1 });

    // Submit form
    await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();

    // Verify success
    await expect(authedPage.getByText(/updated|saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Restore original
    if (originalValue) {
      await timezoneSelect.selectOption(originalValue);
      await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();
      await authedPage.waitForTimeout(1000);
    }
  });

  test('updates restaurant capacity', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Find capacity input
    const capacityInput = authedPage.getByLabel(/Capacity/i).first();
    await capacityInput.waitFor({ state: 'visible', timeout: 15000 });

    // Get original value
    const originalValue = await capacityInput.inputValue();

    // Update capacity
    await capacityInput.fill('150');

    // Submit
    await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();

    // Verify success
    await expect(authedPage.getByText(/updated|saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Restore
    if (originalValue) {
      await capacityInput.fill(originalValue);
      await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();
      await authedPage.waitForTimeout(1000);
    }
  });

  test('updates contact email', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Find email input - look for contact email or similar
    const emailInputs = authedPage.getByLabel(/email/i);
    const contactEmail = emailInputs.filter({ hasText: /contact|restaurant/i }).first().or(emailInputs.last());
    
    await contactEmail.waitFor({ state: 'visible', timeout: 15000 });

    // Get original value
    const originalValue = await contactEmail.inputValue();

    // Update email
    const newEmail = `test-${Date.now()}@example.com`;
    await contactEmail.fill(newEmail);

    // Submit
    await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();

    // Verify success
    await expect(authedPage.getByText(/updated|saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Restore
    if (originalValue) {
      await contactEmail.fill(originalValue);
      await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();
      await authedPage.waitForTimeout(1000);
    }
  });

  test('validates required fields', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Try to clear the name field
    const nameInput = authedPage.getByLabel(/^Name$/i).or(authedPage.getByLabel(/Restaurant name/i)).first();
    await nameInput.waitFor({ state: 'visible', timeout: 15000 });

    const originalValue = await nameInput.inputValue();
    
    await nameInput.fill('');
    await authedPage.getByRole('button', { name: /Save|Update/i }).first().click();

    // Should show validation error
    await expect(authedPage.locator('text=/required|name.*required/i').first()).toBeVisible({ timeout: 5000 });

    // Restore original value
    if (originalValue) {
      await nameInput.fill(originalValue);
    }
  });

  test('shows loading state during save', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Slow down network to see loading state
    await authedPage.route('**/api/**', async (route) => {
      if (route.request().method() !== 'GET') {
        await authedPage.waitForTimeout(2000);
      }
      await route.continue();
    });

    const nameInput = authedPage.getByLabel(/^Name$/i).or(authedPage.getByLabel(/Restaurant name/i)).first();
    await nameInput.waitFor({ state: 'visible', timeout: 15000 });

    const originalValue = await nameInput.inputValue();
    await nameInput.fill(`Test ${Date.now()}`);

    const submitButton = authedPage.getByRole('button', { name: /Save|Update/i }).first();
    await submitButton.click();

    // Should show loading state
    await expect(submitButton).toBeDisabled({ timeout: 2000 });

    // Wait for completion and restore
    await authedPage.waitForTimeout(3000);
    if (originalValue) {
      await authedPage.unroute('**/api/**');
      await nameInput.fill(originalValue);
      await submitButton.click();
      await authedPage.waitForTimeout(1000);
    }
  });
});

test.describe('Ops Restaurant Settings - Operating Hours', () => {
  test('displays operating hours section', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Check for Operating Hours section
    await expect(authedPage.getByText(/Operating Hours/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('displays days of week', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Should display days of week
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (const day of days) {
      await expect(authedPage.getByText(day, { exact: false }).first()).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe('Ops Restaurant Settings - Service Periods', () => {
  test('displays service periods section', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Check for Service Periods section
    await expect(authedPage.getByText(/Service Periods/i).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Ops Restaurant Settings - Mobile viewport', () => {
  test('displays and edits settings on mobile', async ({ authedPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile viewport test runs only on mobile-chrome project.');

    await authedPage.goto('/app/settings/restaurant');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Verify page is usable on mobile
    await expect(authedPage.getByRole('heading', { name: /Restaurant Settings/i })).toBeVisible({ timeout: 10000 });

    // Verify form fields are accessible
    const nameInput = authedPage.getByLabel(/^Name$/i).or(authedPage.getByLabel(/Restaurant name/i)).first();
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // Verify submit button is accessible
    const submitButton = authedPage.getByRole('button', { name: /Save|Update/i }).first();
    await expect(submitButton).toBeVisible();
  });
});
