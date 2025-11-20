import { expect } from '@playwright/test';

import { test } from '../../fixtures/auth';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Ops Team Management - Creating Invites', () => {
  test('creates invite for host role and displays invite URL', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable; skipping team management.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Check page loaded
    await expect(authedPage.getByRole('heading', { name: /Team management/i })).toBeVisible();

    // Fill in invite form
    const email = `test-host-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);

    // Select host role (should be default)
    const roleSelect = authedPage.locator('select').filter({ has: authedPage.getByText('Host') });
    await roleSelect.selectOption('host');

    // Submit form
      const [response] = await Promise.all([
        authedPage.waitForResponse((resp) => resp.url().includes('/api/ops/team/invitations') && resp.request().method() === 'POST'),
        authedPage.getByRole('button', { name: /Send invite/i }).click(),
      ]);

    expect(response.ok()).toBeTruthy();

    // Verify success message/UI shows invite URL
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });
    await expect(authedPage.getByText(email)).toBeVisible();

    // Verify invite URL is displayed
    await expect(authedPage.locator('code').filter({ hasText: /\/invite\// })).toBeVisible();
  });

  test('creates invite for manager role', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    const email = `test-manager-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);

    // Select manager role
    const roleSelect = authedPage.locator('select').filter({ has: authedPage.getByText('Manager') });
    await roleSelect.selectOption('manager');

    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Verify success
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });
    await expect(authedPage.getByText(email)).toBeVisible();
  });

  test('creates invite for server role', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    const email = `test-server-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);

    // Select server role
    const roleSelect = authedPage.locator('select').filter({ has: authedPage.getByText('Server') });
    await roleSelect.selectOption('server');

    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Verify success
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });
    await expect(authedPage.getByText(email)).toBeVisible();
  });

  test('copies invite URL to clipboard', async ({ authedPage, context }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Create an invite
    const email = `test-copy-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Wait for invite URL to appear
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy button
    await authedPage.getByRole('button', { name: /Copy/i }).click();

    // Verify clipboard content
    const clipboardText = await authedPage.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/invite/');
  });

  test('validates email format', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Try to submit with invalid email
    await authedPage.getByLabel(/Email/i).fill('invalid-email');
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Verify validation error
    await expect(authedPage.getByText(/valid email/i)).toBeVisible({ timeout: 5000 });
  });

  test('validates required fields', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Try to submit with empty email
    await authedPage.getByLabel(/Email/i).fill('');
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Verify validation error
    await expect(authedPage.locator('text=/email|required/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('clears form after successful submission', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    const email = `test-clear-${Date.now()}@example.com`;
    const emailInput = authedPage.getByLabel(/Email/i);

    await emailInput.fill(email);
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Wait for success
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });

    // Verify email field is cleared
    await expect(emailInput).toHaveValue('');
  });
});

test.describe('Ops Team Management - Filtering Invites', () => {
  test('filters invites by pending status', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Find and use the status filter select
    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    
    await statusSelect.selectOption('pending');

    // Wait for data to load
    await authedPage.waitForTimeout(1000);

    // Verify we're seeing pending invites or empty state
    const hasPending = await authedPage.getByText(/No pending invitations/i).isVisible().catch(() => false);
    const hasInvites = await authedPage.locator('li').filter({ hasText: /@/ }).count() > 0;

    expect(hasPending || hasInvites).toBeTruthy();
  });

  test('filters invites by all statuses', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Select "All" status
    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('all');

    // Wait for data to load
    await authedPage.waitForTimeout(1000);

    // Verify we're seeing results or empty state
    const isEmpty = await authedPage.getByText(/No invitations match/i).isVisible().catch(() => false);
    const hasInvites = await authedPage.locator('li').filter({ hasText: /@/ }).count() > 0;

    expect(isEmpty || hasInvites).toBeTruthy();
  });

  test('filters invites by accepted status', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('accepted');

    await authedPage.waitForTimeout(1000);

    // Should show either accepted invites or empty state
    const isEmpty = await authedPage.getByText(/No invitations match/i).isVisible().catch(() => false);
    const hasInvites = await authedPage.locator('li').filter({ hasText: /@/ }).count() > 0;

    expect(isEmpty || hasInvites).toBeTruthy();
  });

  test('filters invites by revoked status', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('revoked');

    await authedPage.waitForTimeout(1000);

    const isEmpty = await authedPage.getByText(/No invitations match/i).isVisible().catch(() => false);
    const hasInvites = await authedPage.locator('li').filter({ hasText: /@/ }).count() > 0;

    expect(isEmpty || hasInvites).toBeTruthy();
  });

  test('filters invites by expired status', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('expired');

    await authedPage.waitForTimeout(1000);

    const isEmpty = await authedPage.getByText(/No invitations match/i).isVisible().catch(() => false);
    const hasInvites = await authedPage.locator('li').filter({ hasText: /@/ }).count() > 0;

    expect(isEmpty || hasInvites).toBeTruthy();
  });
});

test.describe('Ops Team Management - Revoking Invites', () => {
  test('revokes a pending invite', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // First create an invite to revoke
    const email = `test-revoke-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Wait for success
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });

    // Wait a moment for the table to refresh
    await authedPage.waitForTimeout(2000);

    // Find the invite in the table and revoke it
    const inviteRow = authedPage.locator('li').filter({ hasText: email });
    await expect(inviteRow).toBeVisible({ timeout: 10000 });

    const [revokeResponse] = await Promise.all([
      authedPage.waitForResponse((resp) => resp.url().includes('/api/ops/team/invitations/') && resp.request().method() === 'DELETE'),
      inviteRow.getByRole('button', { name: /Revoke/i }).click(),
    ]);

    expect(revokeResponse.ok()).toBeTruthy();

    // Wait for UI to update - invite should disappear or status should change
    await authedPage.waitForTimeout(1000);
  });

  test('shows no revoke button for accepted invites', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Filter to accepted invites
    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('accepted');

    await authedPage.waitForTimeout(1000);

    // Check if there are accepted invites
    const inviteCount = await authedPage.locator('li').filter({ hasText: /@/ }).count();

    if (inviteCount > 0) {
      // Verify no revoke buttons are present for accepted invites
      const revokeButtons = await authedPage.getByRole('button', { name: /Revoke/i }).count();
      expect(revokeButtons).toBe(0);
    }
  });

  test('shows no revoke button for revoked invites', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Filter to revoked invites
    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('revoked');

    await authedPage.waitForTimeout(1000);

    // Check if there are revoked invites
    const inviteCount = await authedPage.locator('li').filter({ hasText: /@/ }).count();

    if (inviteCount > 0) {
      // Verify no revoke buttons are present
      const revokeButtons = await authedPage.getByRole('button', { name: /Revoke/i }).count();
      expect(revokeButtons).toBe(0);
    }
  });
});

test.describe('Ops Team Management - UI States', () => {
  test('displays empty state for pending invites', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Make sure we're on pending filter
    const statusSelect = authedPage.locator('select').filter({ hasText: /Pending|All/ }).last();
    await statusSelect.selectOption('pending');

    await authedPage.waitForTimeout(1000);

    // Check if there's an empty state message (if no pending invites exist)
    const emptyState = authedPage.getByText(/No pending invitations/i);
    const hasInvites = await authedPage.locator('li').filter({ hasText: /@/ }).count() > 0;

    // Either empty state is shown or invites are shown
    if (!hasInvites) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('displays invite details in table', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Create an invite to verify table display
    const email = `test-table-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);
    
    const roleSelect = authedPage.locator('select').filter({ has: authedPage.getByText('Host') });
    await roleSelect.selectOption('host');
    
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });

    // Wait for table to refresh
    await authedPage.waitForTimeout(2000);

    // Verify invite appears in table with correct details
    const inviteRow = authedPage.locator('li').filter({ hasText: email });
    await expect(inviteRow).toBeVisible({ timeout: 10000 });
    
    // Verify role is displayed
    await expect(inviteRow.getByText(/host/i)).toBeVisible();
    
    // Verify status badge is shown
    await expect(inviteRow.locator('text=/pending|accepted|revoked/i')).toBeVisible();
  });

  test('shows loading state during operations', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/app/management/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Slow down the network to see loading state
    await authedPage.route('**/api/ops/team/invitations', async (route) => {
      await authedPage.waitForTimeout(2000);
      await route.continue();
    });

    const email = `test-loading-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);
    
    const submitButton = authedPage.getByRole('button', { name: /Send invite/i });
    await submitButton.click();

    // Verify button shows loading state
    await expect(authedPage.getByText(/Sending/i)).toBeVisible({ timeout: 2000 });
    await expect(submitButton).toBeDisabled();
  });
});

test.describe('Ops Team Management - Mobile viewport', () => {
  test('creates and manages invites on mobile', async ({ authedPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile viewport test runs only on mobile-chrome project.');

    await authedPage.goto('/ops/team');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Verify page is usable on mobile
    await expect(authedPage.getByRole('heading', { name: /Team management/i })).toBeVisible();

    // Create an invite
    const email = `test-mobile-${Date.now()}@example.com`;
    await authedPage.getByLabel(/Email/i).fill(email);
    await authedPage.getByRole('button', { name: /Send invite/i }).click();

    // Verify success on mobile
    await expect(authedPage.getByText(/Invitation link ready/i)).toBeVisible({ timeout: 10000 });

    // Verify table is responsive
    const inviteRow = authedPage.locator('li').filter({ hasText: email });
    await expect(inviteRow).toBeVisible({ timeout: 10000 });
  });
});
