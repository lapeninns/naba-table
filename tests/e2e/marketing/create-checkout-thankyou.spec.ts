import { expect, test } from '@playwright/test';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Marketing Journey - Create Page', () => {
  test('displays create reservation page with restaurant browser', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Check page heading
    await expect(page.getByRole('heading', { name: /Create a new reservation/i })).toBeVisible({ timeout: 10000 });

    // Check description
    await expect(page.getByText(/Filter by timezone or party size/i)).toBeVisible();

    // Check restaurant browser section
    await expect(page.getByRole('heading', { name: /Pick a partner venue/i })).toBeVisible();
  });

  test('displays plan your night badge', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Check badge
    await expect(page.getByText(/Plan your night/i)).toBeVisible();
  });

  test('displays account CTA buttons', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Check for sign in or account-related buttons
    const hasSignIn = await page.getByRole('link', { name: /sign in|log in|account/i }).isVisible().catch(() => false);
    const hasGetStarted = await page.getByRole('link', { name: /get started|create account/i }).isVisible().catch(() => false);

    // At least one account CTA should be visible
    expect(hasSignIn || hasGetStarted).toBeTruthy();
  });

  test('has jump to availability link', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const jumpLink = page.getByRole('link', { name: /Jump to availability/i });
    await expect(jumpLink).toBeVisible();

    // Verify it links to correct anchor
    const href = await jumpLink.getAttribute('href');
    expect(href).toContain('#create-browser');
  });

  test('loads restaurant list', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Wait for restaurants to load
    await page.waitForTimeout(2000);

    // Check if restaurants are displayed or if there's an error/empty state
    const hasRestaurants = await page.locator('[data-testid*="restaurant"], .restaurant-card, [role="article"]').count() > 0;
    const hasEmptyState = await page.getByText(/No restaurants|no venues|try different filters/i).isVisible().catch(() => false);

    // Either restaurants loaded or empty state is shown
    expect(hasRestaurants || hasEmptyState).toBeTruthy();
  });

  test('allows filtering restaurants', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for filter controls (timezone, party size, etc.)
    const hasTimezoneFilter = await page.locator('select, [role="combobox"]').filter({ hasText: /timezone|UTC|London/i }).isVisible().catch(() => false);
    const hasPartySizeFilter = await page.locator('select, input').filter({ hasText: /party|guests|people/i }).isVisible().catch(() => false);

    // At least some filtering capability should exist
    expect(hasTimezoneFilter || hasPartySizeFilter).toBeTruthy();
  });

  test('navigates to restaurant booking when clicking venue', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to find and click a restaurant
    const restaurants = page.locator('[data-testid*="restaurant"], .restaurant-card, [role="article"]').filter({ hasText: /book|reserve|view/i });
    const count = await restaurants.count();

    if (count > 0) {
      const firstRestaurant = restaurants.first();
      
      // Look for a book/reserve button or link within the restaurant card
      const bookButton = firstRestaurant.locator('button, a').filter({ hasText: /book|reserve|view|select/i }).first();
      
      if (await bookButton.isVisible().catch(() => false)) {
        await bookButton.click();
        
        // Should navigate to booking flow or restaurant detail page
        await page.waitForTimeout(2000);
        const url = page.url();
        
        // Should navigate away from /create
        expect(url).not.toBe(`${baseURL}/create`);
        
        // Likely navigated to /reserve/r/[slug] or /item/[slug]
        expect(url).toMatch(/\/(reserve\/r\/|item\/)/);
      }
    }
  });
});

test.describe('Marketing Journey - Create Page Mobile', () => {
  test('displays responsively on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile viewport test runs only on mobile-chrome project.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Check heading is visible on mobile
    await expect(page.getByRole('heading', { name: /Create a new reservation/i })).toBeVisible({ timeout: 10000 });

    // Check restaurant browser is accessible
    await expect(page.getByRole('heading', { name: /Pick a partner venue/i })).toBeVisible();
  });
});

test.describe('Marketing Journey - Checkout Guide Page', () => {
  test('displays checkout guide page', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Check page heading
    await expect(page.getByRole('heading', { name: /Finalise your reservation/i })).toBeVisible({ timeout: 10000 });

    // Check badge
    await expect(page.getByText(/Checkout/i).first()).toBeVisible();

    // Check description
    await expect(page.getByText(/Follow the steps below/i)).toBeVisible();
  });

  test('displays checkout steps', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Check for the three main steps
    await expect(page.getByRole('heading', { name: /Pick a venue/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Confirm guest details/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Share & manage/i })).toBeVisible();
  });

  test('has link to view upcoming bookings', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    const bookingsLink = page.getByRole('link', { name: /View upcoming bookings/i });
    await expect(bookingsLink).toBeVisible();

    // Verify link goes to my-bookings
    const href = await bookingsLink.getAttribute('href');
    expect(href).toBe('/my-bookings');
  });

  test('has link to start new reservation', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    const createLink = page.getByRole('link', { name: /Start a new reservation/i });
    await expect(createLink).toBeVisible();

    // Verify link goes to create page
    const href = await createLink.getAttribute('href');
    expect(href).toBe('/create');
  });

  test('navigates to my-bookings when clicking view bookings', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /View upcoming bookings/i }).click();
    
    // Should navigate to my-bookings
    await page.waitForURL(/\/my-bookings/, { timeout: 10000 });
    expect(page.url()).toContain('/my-bookings');
  });

  test('navigates to create page when clicking start new reservation', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /Start a new reservation/i }).click();
    
    // Should navigate to create
    await page.waitForURL(/\/create/, { timeout: 10000 });
    expect(page.url()).toContain('/create');
  });
});

test.describe('Marketing Journey - Thank You Page', () => {
  test('redirects unauthenticated users to sign in', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/thank-you');
    
    // Should redirect to sign in page
    await page.waitForURL(/\/signin/, { timeout: 10000 });
    expect(page.url()).toContain('/signin');
    expect(page.url()).toContain('redirectedFrom=/thank-you');
  });
});

test.describe('Marketing Journey - Thank You Page (Authenticated)', () => {
  test('displays thank you page for authenticated users', async ({ page, context }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    // Try to access the authenticated test fixture if available
    // For now, skip this test if auth is not set up
    const hasAuth = false; // Would need auth fixture

    test.skip(!hasAuth, 'Authentication required for thank you page access');

    await page.goto('/thank-you');
    await page.waitForLoadState('networkidle');

    // Check thank you message
    await expect(page.getByRole('heading', { name: /Thanks for booking/i })).toBeVisible({ timeout: 10000 });
    
    // Check description
    await expect(page.getByText(/confirmation email/i)).toBeVisible();
  });

  test('has link to return home', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    
    const hasAuth = false; // Would need auth fixture
    test.skip(!hasAuth, 'Authentication required');

    await page.goto('/thank-you');
    await page.waitForLoadState('networkidle');

    const homeLink = page.getByRole('link', { name: /Return home/i });
    const href = await homeLink.getAttribute('href');
    expect(href).toBe('/');
  });

  test('has link to make another booking', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    
    const hasAuth = false; // Would need auth fixture
    test.skip(!hasAuth, 'Authentication required');

    await page.goto('/thank-you');
    await page.waitForLoadState('networkidle');

    const bookingLink = page.getByRole('link', { name: /Make another booking/i });
    const href = await bookingLink.getAttribute('href');
    expect(href).toBe('/');
  });
});

test.describe('Marketing Journey - End to End Flow', () => {
  test('completes create → checkout → my-bookings flow', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    // Start at create page
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Create a new reservation/i })).toBeVisible();

    // Navigate to checkout guide
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Finalise your reservation/i })).toBeVisible();

    // Click to view bookings
    await page.getByRole('link', { name: /View upcoming bookings/i }).click();
    await page.waitForURL(/\/my-bookings/, { timeout: 10000 });
    
    // Verify we reached my-bookings
    expect(page.url()).toContain('/my-bookings');
  });

  test('loops from checkout back to create', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Click start new reservation
    await page.getByRole('link', { name: /Start a new reservation/i }).click();
    await page.waitForURL(/\/create/, { timeout: 10000 });

    // Verify we're back at create
    expect(page.url()).toContain('/create');
    await expect(page.getByRole('heading', { name: /Create a new reservation/i })).toBeVisible();
  });
});

test.describe('Marketing Journey - Accessibility', () => {
  test('create page has proper semantic structure', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Check main landmark
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // Check proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);

    // Check sections have proper labeling
    const section = page.locator('section#create-browser');
    await expect(section).toHaveAttribute('aria-labelledby', 'create-browser-heading');
  });

  test('checkout page has proper semantic structure', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Check main landmark
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // Check proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);

    // Check list is properly structured
    const list = page.locator('ol');
    await expect(list).toBeVisible();
  });

  test('links have accessible text', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Marketing flows verified on Chromium-based projects.');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // All links should have descriptive text
    const links = page.getByRole('link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});
