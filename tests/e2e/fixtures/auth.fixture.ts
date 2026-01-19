/**
 * Authentication Fixture for Playwright E2E Tests
 *
 * This fixture provides authenticated browser contexts for guest-facing tests.
 * It uses a test account with magic link authentication workaround for CI.
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';

// Test user configuration - should match a seeded test user in your staging DB
const TEST_GUEST_EMAIL = process.env.E2E_TEST_GUEST_EMAIL || 'e2e-test-guest@nabatable.com';
const TEST_GUEST_NAME = process.env.E2E_TEST_GUEST_NAME || 'E2E Test Guest';

// Storage state paths
const GUEST_AUTH_STATE = 'playwright/.auth/guest.json';

/**
 * Extended test fixture with authenticated guest context
 */
export type AuthFixtures = {
    guestPage: Page;
    guestContext: BrowserContext;
    testGuestEmail: string;
    testGuestName: string;
};

/**
 * Authenticate a guest user via direct session injection
 * This bypasses magic link for CI environments
 */
async function authenticateGuest(page: Page): Promise<void> {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Determine the token to use
    // 1. CI environment variable
    // 2. Local fallback
    const token = process.env.E2E_GUEST_SESSION_TOKEN || 'local-dev-token';



    // Use request context to fetch cookies instead of navigating page
    const apiUrl = `${baseUrl}/api/auth/e2e-login?token=${token}&email=${TEST_GUEST_EMAIL}`;
    const apiResponse = await page.request.get(apiUrl);

    if (!apiResponse.ok()) {
        console.error('❌ E2E Login API failed:', await apiResponse.text());
        throw new Error('E2E Login API failed');
    }

    const { success, cookies: serverCookies, redirectUrl } = await apiResponse.json();

    if (!success || !serverCookies) {
        console.error('❌ E2E Login failed. Response:', { success, hasCookies: !!serverCookies });
        throw new Error('E2E Login failed - valid session not returned');
    }


    // Transform cookies from server format to Playwright format
    const browserCookies = serverCookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        url: baseUrl, // Use exact URL where cookie should apply
        // path: '/', // Removed to rely on URL
        httpOnly: false, // Force false so client-side supabase-js can read the session!
        secure: c.secure, // Should be false from server for localhost
        sameSite: 'Lax' as const
    }));

    await page.context().addCookies(browserCookies);
    const injected = await page.context().cookies();


    if (injected.length === 0) {
        throw new Error('Cookie injection failed!');
    }

    const targetPath = redirectUrl && redirectUrl.startsWith('/') ? redirectUrl : '/guest/bookings';

    // Now navigate to the target page
    await page.goto(`${baseUrl}${targetPath}`);


    // Final check
    if (page.url().includes('signin')) {
        console.error('❌ Redirected to Signin despite cookies!');
        const finalCookies = await page.context().cookies();
        console.error('Final Cookies:', finalCookies.map(c => c.name).join(', '));
    }
    const cookies = await page.context().cookies();


    // Warn if no supabase cookies
    if (!cookies.some(c => c.name.startsWith('sb-'))) {
        console.warn('⚠️ No Supabase cookies found!');
    }
}

/**
 * Extend base test with authenticated fixtures
 */
export const test = base.extend<AuthFixtures>({
    testGuestEmail: TEST_GUEST_EMAIL,
    testGuestName: TEST_GUEST_NAME,

    guestContext: async ({ browser }, use) => {
        // Try to reuse existing auth state
        let context: BrowserContext;

        try {
            context = await browser.newContext({ storageState: GUEST_AUTH_STATE });
        } catch {
            // No stored state, create fresh context
            context = await browser.newContext();
        }

        await use(context);
        await context.close();
    },

    guestPage: async ({ guestContext }, use) => {
        const page = await guestContext.newPage();

        // Check if we need to authenticate
        // Check if we need to authenticate
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        await page.goto(`${baseUrl}/guest/bookings`);

        console.error('👀 Checking Initial URL:', page.url());

        // Force auth for debugging (temporarily removed check)
        // if (page.url().includes('/auth/signin')) {
        console.error('🔄 Performing forced authentication...');
        await authenticateGuest(page);

        // Navigate back to guest area
        await page.goto(`${baseUrl}/guest/bookings`);
        // }

        await use(page);
        await page.close();
    },
});

export { expect } from '@playwright/test';
