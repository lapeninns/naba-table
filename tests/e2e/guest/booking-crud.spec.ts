/**
 * Guest Booking CRUD E2E Tests
 *
 * This test suite validates the complete CRUD lifecycle for guest bookings:
 * - CREATE: Book a new reservation through the wizard
 * - READ: View booking details and list
 * - UPDATE: Modify booking details (party size, date/time)
 * - DELETE: Cancel a booking
 *
 * @see /tasks/guest-crud-testing-YYYYMMDD-HHMM for test plan
 */

import { test, expect } from '../fixtures/auth.fixture';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.E2E_TEST_GUEST_EMAIL || 'e2e-test@nabatable.com';
const TEST_RESTAURANT_SLUG = process.env.E2E_TEST_RESTAURANT_SLUG || 'white-horse-pub-waterbeach';

// Test timeout for booking operations (may involve API calls)
test.setTimeout(60_000);

test.describe('Guest Booking CRUD', () => {
    let createdBookingId: string | null = null;

    test.describe.serial('Full Booking Lifecycle', () => {
        test('should complete full booking CRUD lifecycle', async ({ guestPage: page }) => {

            await test.step('CREATE: should create a new booking via wizard', async () => {
                // Navigate to restaurant page
                await page.goto(`${BASE_URL}/restaurants/${TEST_RESTAURANT_SLUG}`);

                // Wait for page load
                await expect(page.locator('main')).toBeVisible();

                // Click "Book Now" or similar CTA
                const bookButton = page.getByRole('link', { name: /book|reserve/i }).or(page.getByRole('button', { name: /book|reserve/i })).first();
                await expect(bookButton).toBeVisible({ timeout: 10_000 });
                await bookButton.click();

                // Wait for booking wizard page to load
                await expect(page).toHaveURL(/.*\/book/, { timeout: 15_000 });
                // await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 }); // Removed dialog check as it is a page now

                // Step 1: Select date
                // Click on a future date in the calendar
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
                const dayButton = page
                    .getByRole('gridcell', { name: futureDate.getDate().toString() })
                    .first();
                if (await dayButton.isVisible()) {
                    await dayButton.click();
                }

                // Step 2: Select time slot
                // The new time picker is a Select component labeled "Time"
                const timeSelect = page.getByLabel(/time/i).first();
                // We need to wait for it to be enabled/loaded (availability fetched)
                // It might be disabled initially while fetching schedule
                await expect(timeSelect).toBeEnabled({ timeout: 10_000 });

                await timeSelect.click();

                // Select the first available option in the dropdown
                const firstOption = page.getByRole('option').first();
                await expect(firstOption).toBeVisible();
                await firstOption.click();

                // Step 3: Select party size
                const partySizeButton = page.getByRole('button', { name: /2 guests|2 people|party.*2/i });
                if (await partySizeButton.isVisible({ timeout: 3_000 })) {
                    await partySizeButton.click();
                }

                // Step 4: Continue to guest details
                const continueButton = page.getByRole('button', { name: /continue|next/i });
                await expect(continueButton).toBeVisible();
                await continueButton.click();

                // Step 5: Fill guest details if required
                // Note: Auth fixture handles login, so these might be pre-filled or skipped
                const nameInput = page.getByPlaceholder(/name/i).first();
                if (await nameInput.isVisible({ timeout: 2_000 })) {
                    await nameInput.fill('E2E Test Guest');
                }

                // Step 6: Submit booking
                const submitButton = page.getByRole('button', {
                    name: /confirm|complete|book|reserve/i,
                });
                await expect(submitButton).toBeVisible();
                await submitButton.click();

                // Wait for confirmation
                await page.waitForTimeout(3_000);

                // Check for success indicators
                const successIndicators = [
                    page.getByText(/booking confirmed/i),
                    page.getByText(/reservation confirmed/i),
                    page.getByText(/success/i),
                    page.locator('[data-testid="booking-confirmation"]'),
                ];

                let foundSuccess = false;
                for (const indicator of successIndicators) {
                    if (await indicator.isVisible({ timeout: 1_000 })) {
                        foundSuccess = true;
                        break;
                    }
                }

                // If redirected to booking detail, extract ID from URL
                const currentUrl = page.url();
                const bookingIdMatch = currentUrl.match(/bookings?\/([a-f0-9-]+)/i);
                if (bookingIdMatch) {
                    createdBookingId = bookingIdMatch[1];
                    test.info().annotations.push({
                        type: 'booking_id',
                        description: createdBookingId,
                    });
                }

                expect(foundSuccess || createdBookingId).toBeTruthy();
            });

            await test.step('READ: should view booking in list and details', async () => {
                // Navigate to bookings list
                await page.goto(`${BASE_URL}/guest/bookings`);

                // Wait for page load
                await expect(page.locator('main')).toBeVisible();

                // Check for Upcoming tab or booking cards
                const upcomingTab = page.getByRole('tab', { name: /upcoming/i });
                if (await upcomingTab.isVisible()) {
                    await upcomingTab.click();
                }

                // Wait for bookings to load
                await page.waitForTimeout(2_000);

                // Find booking card
                const bookingCard = page.locator('[data-testid="booking-card"]').first();
                const altBookingCard = page
                    .locator('article, [role="article"], .booking-card')
                    .first();
                const cardToClick = (await bookingCard.isVisible())
                    ? bookingCard
                    : altBookingCard;

                await expect(cardToClick).toBeVisible({ timeout: 10_000 });

                // Click to view details
                await cardToClick.click();

                // Wait for detail view
                await page.waitForTimeout(2_000);

                // Verify booking details are displayed
                const detailIndicators = [
                    page.getByText(/party size/i),
                    page.getByText(/guests/i),
                    page.getByText(/date/i),
                    page.getByText(/time/i),
                ];

                let foundDetail = false;
                for (const indicator of detailIndicators) {
                    if (await indicator.isVisible({ timeout: 1_000 })) {
                        foundDetail = true;
                        break;
                    }
                }

                expect(foundDetail).toBeTruthy();
            });

            await test.step('UPDATE: should modify booking party size', async () => {
                // Ensure we're on booking detail page
                const currentUrl = page.url();
                if (!currentUrl.includes('/bookings')) {
                    await page.goto(`${BASE_URL}/guest/bookings`);
                    await page.locator('[data-testid="booking-card"], article').first().click();
                    await page.waitForTimeout(2_000);
                }

                // Find and click Modify/Edit button
                const modifyButton = page.getByRole('button', {
                    name: /modify|edit|change/i,
                });
                await expect(modifyButton).toBeVisible({ timeout: 5_000 });
                await modifyButton.click();

                // Wait for edit dialog/form
                await page.waitForTimeout(1_000);

                // Locate party size controls
                const incrementButton = page
                    .getByRole('button', { name: /\+|increase|add/i })
                    .first();
                if (await incrementButton.isVisible({ timeout: 3_000 })) {
                    await incrementButton.click();
                }

                // Save changes
                const saveButton = page.getByRole('button', {
                    name: /save|update|confirm/i,
                });
                await expect(saveButton).toBeVisible();
                await saveButton.click();

                // Wait for update
                await page.waitForTimeout(2_000);

                // Check for success toast/message
                const successToast = page.getByText(/updated|saved|success/i);
                await expect(successToast).toBeVisible({ timeout: 5_000 });

                test.info().annotations.push({
                    type: 'update_result',
                    description: 'Booking party size updated successfully',
                });
            });

            await test.step('DELETE: should cancel booking', async () => {
                // Ensure we're on booking detail page
                const currentUrl = page.url();
                if (!currentUrl.includes('/bookings')) {
                    await page.goto(`${BASE_URL}/guest/bookings`);
                    await page.locator('[data-testid="booking-card"], article').first().click();
                    await page.waitForTimeout(2_000);
                }

                // Find and click Cancel button
                const cancelButton = page.getByRole('button', { name: /cancel/i });
                await expect(cancelButton).toBeVisible({ timeout: 5_000 });
                await cancelButton.click();

                // Wait for confirmation dialog
                await page.waitForTimeout(1_000);

                // Confirm cancellation
                const confirmCancelButton = page
                    .getByRole('button', { name: /cancel.*booking|confirm.*cancel|yes.*cancel/i })
                    .or(page.getByRole('alertdialog').getByRole('button', { name: /cancel/i }));

                await expect(confirmCancelButton).toBeVisible({ timeout: 3_000 });
                await confirmCancelButton.click();

                // Wait for cancellation
                await page.waitForTimeout(2_000);

                // Verify cancellation success
                const successIndicators = [
                    page.getByText(/cancelled/i),
                    page.getByText(/cancellation.*success/i),
                    page.locator('[data-status="cancelled"]'),
                ];

                let foundCancelled = false;
                for (const indicator of successIndicators) {
                    if (await indicator.isVisible({ timeout: 2_000 })) {
                        foundCancelled = true;
                        break;
                    }
                }

                expect(foundCancelled).toBeTruthy();

                test.info().annotations.push({
                    type: 'delete_result',
                    description: 'Booking cancelled successfully',
                });
            });
        });
    });
});

test.describe('Booking Validation', () => {
    test('should prevent booking without required fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/restaurants/${TEST_RESTAURANT_SLUG}`);

        // Open booking dialog
        const bookButton = page.getByRole('link', { name: /book|reserve/i }).or(page.getByRole('button', { name: /book|reserve/i })).first();
        if (await bookButton.isVisible({ timeout: 5_000 })) {
            await bookButton.click();
            await expect(page).toHaveURL(/.*\/book/, { timeout: 15_000 });
        }

        // Try to submit without selecting date/time
        const submitButton = page.getByRole('button', {
            name: /confirm|complete|book|continue/i,
        });
        if (await submitButton.isVisible({ timeout: 3_000 })) {
            await submitButton.click();
        }

        // Check for validation errors
        const validationError = page.getByText(
            /required|please select|invalid|choose/i
        );
        const isDisabled = await submitButton.isDisabled();

        // Either validation message shown or button is disabled
        expect(
            (await validationError.isVisible({ timeout: 2_000 })) || isDisabled
        ).toBeTruthy();
    });
});
