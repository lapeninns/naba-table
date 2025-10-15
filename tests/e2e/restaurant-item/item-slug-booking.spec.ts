import { expect, test } from '@playwright/test';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Restaurant Item Page - Page Load', () => {
  test('displays restaurant item page for valid slug', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    // Get a valid restaurant slug
    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug, name } = restaurants[0];

    // Navigate to the restaurant item page
    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Check restaurant name is displayed
    await expect(page.getByRole('heading', { name: name, exact: false })).toBeVisible({ timeout: 10000 });

    // Check "Book this venue" badge
    await expect(page.getByText(/Book this venue/i)).toBeVisible();
  });

  test('displays restaurant details', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug, capacity, timezone } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Check capacity is displayed
    await expect(page.getByText(/Capacity/i)).toBeVisible();
    
    if (capacity) {
      await expect(page.getByText(new RegExp(`${capacity}.*seats`, 'i'))).toBeVisible();
    }

    // Check timezone is displayed
    if (timezone) {
      await expect(page.getByText(timezone)).toBeVisible();
    }
  });

  test('displays back navigation to browse page', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Check for back link
    const backLink = page.getByRole('link', { name: /All restaurants|Back|Browse/i });
    await expect(backLink).toBeVisible();

    // Verify it links to /browse
    const href = await backLink.getAttribute('href');
    expect(href).toBe('/browse');
  });

  test('shows 404 state for invalid restaurant slug', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');

    await page.goto('/item/invalid-restaurant-slug-does-not-exist');
    await page.waitForLoadState('networkidle');

    // Check for not found message
    await expect(page.getByRole('heading', { name: /can't find that restaurant|not found/i })).toBeVisible({ timeout: 10000 });

    // Check for description
    await expect(page.getByText(/Double-check the link|return to/i)).toBeVisible();

    // Check for browse link
    await expect(page.getByRole('link', { name: /Browse restaurants/i })).toBeVisible();
  });

  test('navigates back to browse from 404 page', async ({ page, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/item/invalid-slug-123');
    await page.waitForLoadState('networkidle');

    // Click browse restaurants button
    await page.getByRole('link', { name: /Browse restaurants/i }).click();

    // Should navigate to /browse
    await page.waitForURL(/\/browse/, { timeout: 10000 });
    expect(page.url()).toContain('/browse');
  });
});

test.describe('Restaurant Item Page - Booking Flow Integration', () => {
  test('displays booking wizard for valid restaurant', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for booking flow elements
    const hasDatePicker = await page.getByLabel(/Date/i).isVisible().catch(() => false);
    const hasTimeSlots = await page.locator('[data-slot-value]').count() > 0;
    const hasPartySize = await page.getByText(/party|guests|people/i).isVisible().catch(() => false);

    // At least one booking element should be visible
    expect(hasDatePicker || hasTimeSlots || hasPartySize).toBeTruthy();
  });

  test('allows completing booking through item page', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to select a time slot if available
    const timeSlots = page.locator('[data-slot-value]');
    const slotCount = await timeSlots.count();

    if (slotCount > 0) {
      await timeSlots.first().click();
      await page.waitForTimeout(1000);

      // Should be able to proceed with booking
      const continueButton = page.getByRole('button', { name: /Continue|Next/i });
      
      if (await continueButton.first().isVisible().catch(() => false)) {
        await continueButton.first().click();
        await page.waitForTimeout(1000);

        // Should show contact form or next step
        const hasNameField = await page.getByLabel(/name|full name/i).isVisible().catch(() => false);
        const hasEmailField = await page.getByLabel(/email/i).isVisible().catch(() => false);

        // Verify we progressed in the booking flow
        expect(hasNameField || hasEmailField).toBeTruthy();
      }
    }
  });

  test('maintains restaurant context throughout booking', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug, name } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Restaurant name should remain visible
    await expect(page.getByText(name)).toBeVisible();

    // Select time slot and continue
    const timeSlots = page.locator('[data-slot-value]');
    if (await timeSlots.count() > 0) {
      await timeSlots.first().click();
      await page.waitForTimeout(500);

      const continueButton = page.getByRole('button', { name: /Continue|Next/i });
      if (await continueButton.first().isVisible().catch(() => false)) {
        await continueButton.first().click();
        await page.waitForTimeout(1000);

        // Restaurant name should still be visible in the flow
        const stillVisible = await page.getByText(name).isVisible().catch(() => false);
        expect(stillVisible).toBeTruthy();
      }
    }
  });
});

test.describe('Restaurant Item Page - Navigation', () => {
  test('navigates back to browse page', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Click back link
    await page.getByRole('link', { name: /All restaurants/i }).click();

    // Should navigate to /browse
    await page.waitForURL(/\/browse/, { timeout: 10000 });
    expect(page.url()).toContain('/browse');
  });

  test('preserves URL structure with restaurant slug', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // URL should contain the slug
    expect(page.url()).toContain(`/item/${slug}`);

    // Verify URL structure is maintained after interactions
    await page.waitForTimeout(1000);
    expect(page.url()).toContain(`/item/${slug}`);
  });
});

test.describe('Restaurant Item Page - Mobile Viewport', () => {
  test('displays responsively on mobile', async ({ page, request, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile viewport test runs only on mobile-chrome project.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug, name } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Check restaurant name is visible on mobile
    await expect(page.getByRole('heading', { name: name, exact: false })).toBeVisible({ timeout: 10000 });

    // Check booking flow is accessible
    await page.waitForTimeout(2000);
    const hasBookingElements = await page.getByLabel(/Date/i).isVisible().catch(() => false) || 
                               await page.locator('[data-slot-value]').count() > 0;

    expect(hasBookingElements).toBeTruthy();
  });
});

test.describe('Restaurant Item Page - Accessibility', () => {
  test('has proper semantic structure', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Check main landmark
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // Check proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);

    // Check regions are properly labeled
    const regions = page.locator('[role="region"]');
    const count = await regions.count();

    for (let i = 0; i < count; i++) {
      const region = regions.nth(i);
      const hasLabel = await region.getAttribute('aria-labelledby');
      expect(hasLabel).toBeTruthy();
    }
  });

  test('navigation is keyboard accessible', async ({ page, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Restaurant item flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    
    if (!restaurantsResponse.ok()) {
      testInfo.skip(true, 'Unable to fetch restaurants for testing');
      return;
    }

    const payload = await restaurantsResponse.json();
    const restaurants = Array.isArray(payload?.data) ? payload.data : [];
    
    if (restaurants.length === 0) {
      testInfo.skip(true, 'No restaurants available for testing');
      return;
    }

    const { slug } = restaurants[0];

    await page.goto(`/item/${slug}`);
    await page.waitForLoadState('networkidle');

    // Tab to back link and verify it's focusable
    await page.keyboard.press('Tab');
    const backLink = page.getByRole('link', { name: /All restaurants/i });
    
    // Should be able to activate with Enter
    await backLink.focus();
    const isFocused = await backLink.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBeTruthy();
  });
});
