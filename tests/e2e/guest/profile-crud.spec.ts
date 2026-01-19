/**
 * Guest Profile CRUD E2E Tests
 *
 * This test suite validates profile management for guest users:
 * - READ: View profile information
 * - UPDATE: Modify profile details (name)
 *
 * Note: CREATE is handled via auth flow, DELETE is not yet implemented
 *
 * @see /tasks/guest-crud-testing-YYYYMMDD-HHMM for test plan
 */

import { test, expect } from '../fixtures/auth.fixture';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.E2E_TEST_GUEST_EMAIL || 'e2e-test-guest@nabatable.com';

test.setTimeout(45_000);

test.describe('Guest Profile', () => {

    test.describe.serial('Profile Management', () => {
        // Shared test function for authenticated profile flow
        test('should manage profile details', async ({ guestPage: page }) => {

            await test.step('READ: should display user profile information', async () => {
                // Navigate to profile page
                await page.goto(`${BASE_URL}/guest/profile`);
                await page.waitForTimeout(1000);

                // Wait for page load
                await expect(page.locator('main')).toBeVisible();

                try {
                    // Check for profile elements
                    // Email is in an input, so check its value using the known label
                    const emailInput = page.getByLabel('Email Address');
                    const heading = page.getByRole('heading', { name: /profile/i }).first();

                    await expect(heading).toBeVisible();
                    await expect(emailInput).toHaveValue(TEST_EMAIL);
                } catch (e) {
                    console.log('❌ TEST FAILED. PAGE CONTENT DUMP:');
                    console.log(await page.content());
                    throw e;
                }
            });

            await test.step('UPDATE: should update user name', async () => {
                // Ensure we're on profile page
                await page.goto(`${BASE_URL}/guest/profile`);
                await page.waitForTimeout(1_000);

                // Find name input by label "Display Name"
                const nameInput = page.getByLabel('Display Name');

                await expect(nameInput).toBeVisible({ timeout: 5_000 });

                // Generate unique name with timestamp
                const timestamp = Date.now();
                const newName = `E2E Test ${timestamp}`;

                // Clear and fill new name
                await nameInput.clear();
                await nameInput.fill(newName);

                // Save changes
                const saveButton = page.getByRole('button', {
                    name: /save/i,
                });
                await expect(saveButton).toBeVisible();
                await saveButton.click();

                // Wait for save
                await page.waitForTimeout(2_000);

                // Check for success indicator
                // Check for success indicator
                const successIndicator = page.getByText('Profile updated successfully!');
                await expect(successIndicator).toBeVisible({ timeout: 5000 });

                // Verify the new name persists after reload
                await page.reload();
                await page.waitForTimeout(2_000);

                const updatedNameInput = page.getByLabel('Display Name');
                const inputValue = await updatedNameInput.inputValue();

                expect(inputValue).toContain('E2E Test');

                test.info().annotations.push({
                    type: 'update_result',
                    description: `Profile name updated to: ${newName}`,
                });
            });
        });
    });
});

test.describe('Profile Accessibility', () => {
    test('should have proper keyboard navigation', async ({ guestPage: page }) => {
        await page.goto(`${BASE_URL}/guest/profile`);
        await page.waitForTimeout(1_000);

        // Tab through interactive elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Check that focus is visible
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Verify focus indicator is present
        const focusStyles = await focusedElement.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
                outline: styles.outline,
                boxShadow: styles.boxShadow,
            };
        });

        // Should have some focus indicator (outline or box-shadow)
        const hasFocusIndicator =
            focusStyles.outline !== 'none' ||
            focusStyles.boxShadow !== 'none';
        expect(hasFocusIndicator).toBeTruthy();
    });

    test('should have accessible form labels', async ({ guestPage: page }) => {
        await page.goto(`${BASE_URL}/guest/profile`);
        await page.waitForTimeout(1_000);

        // Check for labeled inputs
        // "Display Name" and "Email Address" are explicit labels in the component
        const nameInput = page.getByLabel('Display Name');
        const emailInput = page.getByLabel('Email Address');

        await expect(nameInput).toBeVisible();
        await expect(emailInput).toBeVisible();

        // Verify accessible names match
        await expect(nameInput).toHaveAttribute('aria-invalid', 'false'); // Basic a11y check
    });
});
