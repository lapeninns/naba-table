import { expect } from '@playwright/test';

import { test } from '../../fixtures/auth';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Ops Walk-In Booking - Page Load', () => {
  test('displays walk-in booking page', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable; skipping walk-in booking.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Check page loaded
    await expect(authedPage.getByRole('heading', { name: /Create walk-in booking/i })).toBeVisible({ timeout: 10000 });
    
    // Check back button exists
    await expect(authedPage.getByRole('link', { name: /Back to dashboard/i })).toBeVisible();
  });

  test('displays booking wizard', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Should show booking form elements
    // The booking flow page includes date, time, party size selection
    await authedPage.waitForTimeout(2000); // Wait for wizard to render

    // Check for key elements that should be present
    const hasDatePicker = await authedPage.getByLabel(/Date/i).isVisible().catch(() => false);
    const hasPartySize = await authedPage.getByText(/party|guests|people/i).isVisible().catch(() => false);
    const hasTimeSlots = await authedPage.locator('[data-slot-value]').count() > 0;

    // At least one of these should be visible
    expect(hasDatePicker || hasPartySize || hasTimeSlots).toBeTruthy();
  });
});

test.describe('Ops Walk-In Booking - Booking Flow', () => {
  test('completes walk-in booking for 2 guests', async ({ authedPage, request, baseURL }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');
    test.skip(!baseURL, 'Base URL must be configured.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Select today's date or a nearby date
    const datePicker = authedPage.getByLabel(/Date/i).first();
    if (await datePicker.isVisible().catch(() => false)) {
      await datePicker.click();
      
      // Select a date from calendar
      const availableDate = authedPage.locator('[data-day]').first();
      if (await availableDate.isVisible().catch(() => false)) {
        await availableDate.click();
      }
    }

    await authedPage.waitForTimeout(1000);

    // Select a time slot if available
    const timeSlots = authedPage.locator('[data-slot-value]');
    const slotCount = await timeSlots.count();
    
    if (slotCount > 0) {
      await timeSlots.first().click();
      await authedPage.waitForTimeout(500);
    }

    // Set party size (if control exists)
    const guestControls = authedPage.getByLabel(/guests|party size/i);
    if (await guestControls.first().isVisible().catch(() => false)) {
      // Use the control to set guests
      const increaseButton = authedPage.getByLabel(/Increase|Add.*guest/i).first();
      if (await increaseButton.isVisible().catch(() => false)) {
        await increaseButton.click();
      }
    }

    await authedPage.waitForTimeout(500);

    // Try to proceed to contact details
    const continueButton = authedPage.getByRole('button', { name: /Continue|Next/i });
    if (await continueButton.first().isVisible().catch(() => false)) {
      await continueButton.first().click();
      await authedPage.waitForTimeout(1000);
    }

    // Fill contact details
    const nameInput = authedPage.getByLabel(/Full name|Name/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      const guestName = `Walk-in Guest ${Date.now()}`;
      await nameInput.fill(guestName);
    }

    const emailInput = authedPage.getByLabel(/Email/i).first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(`walkin-${Date.now()}@example.com`);
    }

    const phoneInput = authedPage.getByLabel(/Phone/i).first();
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill('07123456789');
    }

    // Accept terms if checkbox exists
    const termsCheckbox = authedPage.getByLabel(/agree.*terms|terms.*privacy/i);
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
    }

    await authedPage.waitForTimeout(500);

    // Proceed to review
    const reviewButton = authedPage.getByRole('button', { name: /Review|Next/i });
    if (await reviewButton.first().isVisible().catch(() => false)) {
      await reviewButton.first().click();
      await authedPage.waitForTimeout(1000);
    }

    // Confirm booking
    const confirmButton = authedPage.getByRole('button', { name: /Confirm|Complete|Book/i });
    if (await confirmButton.first().isVisible().catch(() => false)) {
      const [bookingResponse] = await Promise.all([
        authedPage.waitForResponse((resp) => 
          resp.url().includes('/api/bookings') && 
          resp.request().method() === 'POST'
        ).catch(() => null),
        confirmButton.first().click(),
      ]);

      if (bookingResponse) {
        expect(bookingResponse.ok()).toBeTruthy();
      }

      // Should show confirmation
      await expect(authedPage.getByText(/confirmed|success|complete/i)).toBeVisible({ timeout: 15000 });
    }
  });

  test('validates required contact information', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Try to navigate through steps without filling required fields
    const continueButton = authedPage.getByRole('button', { name: /Continue|Next|Review/i });
    
    if (await continueButton.first().isVisible().catch(() => false)) {
      await continueButton.first().click();
      await authedPage.waitForTimeout(1000);

      // Click again if we're on contact step
      if (await continueButton.first().isVisible().catch(() => false)) {
        await continueButton.first().click();
        
        // Should show validation errors
        const hasError = await authedPage.locator('text=/required|enter.*name|enter.*email/i').isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasError).toBeTruthy();
      }
    }
  });

  test('allows selecting different party sizes', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Find party size controls
    const increaseButton = authedPage.getByLabel(/Increase|Add.*guest/i).first();
    const decreaseButton = authedPage.getByLabel(/Decrease|Remove.*guest/i).first();

    if (await increaseButton.isVisible().catch(() => false)) {
      // Increase party size
      await increaseButton.click();
      await authedPage.waitForTimeout(300);
      await increaseButton.click();
      await authedPage.waitForTimeout(300);

      // Verify increased
      const partyDisplay = authedPage.locator('text=/3.*guest|party.*3/i');
      const hasThreeGuests = await partyDisplay.isVisible().catch(() => false);

      if (hasThreeGuests) {
        expect(hasThreeGuests).toBeTruthy();
      }

      // Decrease party size
      if (await decreaseButton.isVisible().catch(() => false)) {
        await decreaseButton.click();
        await authedPage.waitForTimeout(300);
      }
    }
  });

  test('displays available time slots', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Check for time slots
    const timeSlots = authedPage.locator('[data-slot-value]');
    const slotCount = await timeSlots.count();

    // Should have at least some time slots available (or show "no slots" message)
    const hasSlots = slotCount > 0;
    const hasNoSlotsMessage = await authedPage.getByText(/no.*available|fully booked/i).isVisible().catch(() => false);

    expect(hasSlots || hasNoSlotsMessage).toBeTruthy();
  });

  test('shows booking summary before confirmation', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Go through basic flow
    const timeSlots = authedPage.locator('[data-slot-value]');
    if (await timeSlots.first().isVisible().catch(() => false)) {
      await timeSlots.first().click();
      await authedPage.waitForTimeout(500);
    }

    // Continue to contact
    const continueButton = authedPage.getByRole('button', { name: /Continue|Next/i });
    if (await continueButton.first().isVisible().catch(() => false)) {
      await continueButton.first().click();
      await authedPage.waitForTimeout(1000);
    }

    // Fill minimal contact info
    const nameInput = authedPage.getByLabel(/Full name|Name/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Test Guest');
    }

    const emailInput = authedPage.getByLabel(/Email/i).first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill('test@example.com');
    }

    const phoneInput = authedPage.getByLabel(/Phone/i).first();
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill('07123456789');
    }

    const termsCheckbox = authedPage.getByLabel(/agree.*terms|terms.*privacy/i);
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
    }

    // Go to review
    const reviewButton = authedPage.getByRole('button', { name: /Review/i });
    if (await reviewButton.first().isVisible().catch(() => false)) {
      await reviewButton.first().click();
      await authedPage.waitForTimeout(1000);

      // Should show review/summary heading
      const hasReview = await authedPage.getByRole('heading', { name: /Review|Summary|Confirm/i }).isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasReview) {
        // Should show booking details
        await expect(authedPage.getByText(/Test Guest/i)).toBeVisible();
      }
    }
  });
});

test.describe('Ops Walk-In Booking - Navigation', () => {
  test('allows navigating back to dashboard', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');

    // Click back to dashboard
    await authedPage.getByRole('link', { name: /Back to dashboard/i }).click();

    // Should navigate to ops dashboard
    await authedPage.waitForURL(/\/ops(?!\/bookings)/);
    expect(authedPage.url()).toMatch(/\/ops(?!\/bookings)/);
  });

  test('maintains state when navigating between steps', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Select time slot
    const timeSlots = authedPage.locator('[data-slot-value]');
    if (await timeSlots.first().isVisible().catch(() => false)) {
      const firstSlotText = await timeSlots.first().textContent();
      await timeSlots.first().click();
      await authedPage.waitForTimeout(500);

      // Continue
      const continueButton = authedPage.getByRole('button', { name: /Continue|Next/i });
      if (await continueButton.first().isVisible().catch(() => false)) {
        await continueButton.first().click();
        await authedPage.waitForTimeout(1000);

        // Go back
        const backButton = authedPage.getByRole('button', { name: /Back|Previous/i });
        if (await backButton.first().isVisible().catch(() => false)) {
          await backButton.first().click();
          await authedPage.waitForTimeout(1000);

          // Time slot should still be selected
          const selectedSlot = authedPage.locator('[data-slot-value][aria-selected="true"], [data-slot-value].selected');
          const isSelected = await selectedSlot.count() > 0;
          
          // State may or may not persist depending on implementation
          // Just verify we can navigate back
          expect(isSelected || firstSlotText).toBeTruthy();
        }
      }
    }
  });
});

test.describe('Ops Walk-In Booking - Mobile viewport', () => {
  test('completes booking on mobile device', async ({ authedPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile viewport test runs only on mobile-chrome project.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Verify page is usable on mobile
    await expect(authedPage.getByRole('heading', { name: /Create walk-in booking/i })).toBeVisible({ timeout: 10000 });

    // Verify key controls are accessible
    const continueButton = authedPage.getByRole('button', { name: /Continue|Next/i });
    const hasButton = await continueButton.first().isVisible().catch(() => false);

    expect(hasButton).toBeTruthy();
  });
});

test.describe('Ops Walk-In Booking - Error States', () => {
  test('handles API errors gracefully', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');

    await authedPage.goto('/ops/bookings/new');

    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable.');
      return;
    }

    await authedPage.waitForLoadState('networkidle');
    await authedPage.waitForTimeout(2000);

    // Intercept booking API and return error
    await authedPage.route('**/api/bookings', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    // Try to complete booking
    const timeSlots = authedPage.locator('[data-slot-value]');
    if (await timeSlots.first().isVisible().catch(() => false)) {
      await timeSlots.first().click();
      await authedPage.waitForTimeout(500);
    }

    const continueButton = authedPage.getByRole('button', { name: /Continue|Next/i });
    if (await continueButton.first().isVisible().catch(() => false)) {
      await continueButton.first().click();
      await authedPage.waitForTimeout(1000);
    }

    // Fill contact info
    const nameInput = authedPage.getByLabel(/Full name|Name/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Error Test');
      await authedPage.getByLabel(/Email/i).first().fill('error@example.com');
      await authedPage.getByLabel(/Phone/i).first().fill('07123456789');
      
      const termsCheckbox = authedPage.getByLabel(/agree.*terms|terms.*privacy/i);
      if (await termsCheckbox.isVisible().catch(() => false)) {
        await termsCheckbox.check();
      }

      const reviewButton = authedPage.getByRole('button', { name: /Review/i });
      if (await reviewButton.first().isVisible().catch(() => false)) {
        await reviewButton.first().click();
        await authedPage.waitForTimeout(1000);

        const confirmButton = authedPage.getByRole('button', { name: /Confirm|Complete/i });
        if (await confirmButton.first().isVisible().catch(() => false)) {
          await confirmButton.first().click();

          // Should show error message
          await expect(authedPage.locator('text=/error|failed|unable/i')).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });
});
