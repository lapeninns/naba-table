/**
 * Visual Regression Tests
 *
 * Captures screenshots of key pages and compares them against baseline images.
 * Catches unintended visual changes before they reach production.
 *
 * Usage:
 * - First run creates baseline screenshots
 * - Subsequent runs compare against baselines
 * - Update baselines with: pnpm test:e2e:update-snapshots
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Viewport configurations to test
const VIEWPORTS = {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 900 },
};

// Pages and components to capture
const VISUAL_TESTS = [
    {
        name: 'home-page',
        path: '/',
        waitFor: 'main',
    },
    {
        name: 'signin-page',
        path: '/auth/signin',
        waitFor: 'form',
    },
    {
        name: 'restaurant-page',
        path: '/restaurants/white-horse-pub-waterbeach',
        waitFor: '[data-testid="restaurant-hero"], main',
        scrollTo: 'top',
    },
];

// Stable elements that should be hidden/masked for consistent screenshots
const MASK_SELECTORS = [
    '[data-testid="loading-spinner"]',
    '[data-crisp-widget]',
    'iframe',
    '[data-dynamic-content]',
    'video',
];

// Configure snapshot comparison
const SNAPSHOT_OPTIONS = {
    maxDiffPixelRatio: 0.01, // Allow 1% difference
    threshold: 0.2, // Color difference threshold
    animations: 'disabled' as const,
};

test.describe('Visual Regression Tests', () => {
    test.setTimeout(90_000);

    // Wait for page to be stable before screenshot
    async function waitForPageStable(page: Page, waitForSelector?: string) {
        // Wait for network to be idle
        await page.waitForLoadState('networkidle');

        // Wait for specific element if provided
        if (waitForSelector) {
            try {
                await page.waitForSelector(waitForSelector, { timeout: 10_000 });
            } catch {
                // Element might not exist on this page
            }
        }

        // Wait for animations to complete
        await page.evaluate(() => {
            return new Promise<void>((resolve) => {
                // Wait for any CSS animations to complete
                const animations = document.getAnimations();
                if (animations.length === 0) {
                    resolve();
                    return;
                }
                Promise.all(animations.map((a) => a.finished)).then(() => resolve());
            });
        });

        // Additional stability wait
        await page.waitForTimeout(500);
    }

    // Hide dynamic elements for consistent screenshots
    async function hideDynamicElements(page: Page) {
        await page.evaluate((selectors) => {
            selectors.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                    (el as HTMLElement).style.visibility = 'hidden';
                });
            });
        }, MASK_SELECTORS);
    }

    // Full page visual tests for each viewport
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        test.describe(`${viewportName} viewport`, () => {
            for (const visualTest of VISUAL_TESTS) {
                test(`${visualTest.name} should match snapshot`, async ({ page }) => {
                    // Set viewport
                    await page.setViewportSize(viewport);

                    // Navigate to page
                    await page.goto(`${BASE_URL}${visualTest.path}`);
                    await waitForPageStable(page, visualTest.waitFor);
                    await hideDynamicElements(page);

                    // Scroll to top for consistent starting point
                    if (visualTest.scrollTo === 'top') {
                        await page.evaluate(() => window.scrollTo(0, 0));
                    }

                    // Capture and compare screenshot
                    await expect(page).toHaveScreenshot(
                        `${visualTest.name}-${viewportName}.png`,
                        {
                            ...SNAPSHOT_OPTIONS,
                            fullPage: false, // Only visible viewport
                        }
                    );
                });
            }
        });
    }

    // Component-level visual tests
    test.describe('Component Snapshots', () => {
        test('Sign-in form should match snapshot', async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/auth/signin`);
            await waitForPageStable(page, 'form');

            const form = page.locator('form').first();
            await expect(form).toHaveScreenshot('signin-form.png', SNAPSHOT_OPTIONS);
        });

        test('Navigation header should match snapshot', async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/`);
            await waitForPageStable(page, 'header');

            const header = page.locator('header').first();
            if (await header.isVisible()) {
                await expect(header).toHaveScreenshot('header.png', SNAPSHOT_OPTIONS);
            }
        });

        test('Footer should match snapshot', async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/`);
            await waitForPageStable(page, 'footer');

            const footer = page.locator('footer').first();
            if (await footer.isVisible()) {
                await expect(footer).toHaveScreenshot('footer.png', SNAPSHOT_OPTIONS);
            }
        });
    });

    // Interactive state visual tests
    test.describe('Interactive States', () => {
        test('Button hover states should match snapshot', async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/auth/signin`);
            await waitForPageStable(page, 'button');

            const button = page.getByRole('button', { name: /sign in|continue/i }).first();
            if (await button.isVisible()) {
                // Capture normal state
                await expect(button).toHaveScreenshot('button-normal.png', SNAPSHOT_OPTIONS);

                // Capture hover state
                await button.hover();
                await page.waitForTimeout(300);
                await expect(button).toHaveScreenshot('button-hover.png', SNAPSHOT_OPTIONS);
            }
        });

        test('Input focus states should match snapshot', async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/auth/signin`);
            await waitForPageStable(page, 'input');

            const input = page.getByPlaceholder(/email/i).first();
            if (await input.isVisible()) {
                // Capture unfocused state
                await expect(input).toHaveScreenshot('input-unfocused.png', SNAPSHOT_OPTIONS);

                // Capture focused state
                await input.focus();
                await page.waitForTimeout(300);
                await expect(input).toHaveScreenshot('input-focused.png', SNAPSHOT_OPTIONS);
            }
        });
    });

    // Dark mode visual tests (if supported)
    test.describe('Dark Mode', () => {
        test('Home page in dark mode should match snapshot', async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.desktop);

            // Emulate dark color scheme
            await page.emulateMedia({ colorScheme: 'dark' });

            await page.goto(`${BASE_URL}/`);
            await waitForPageStable(page, 'main');
            await hideDynamicElements(page);

            await expect(page).toHaveScreenshot('home-dark-mode.png', {
                ...SNAPSHOT_OPTIONS,
                fullPage: false,
            });
        });
    });

    // Responsive design breakpoint tests
    test.describe('Responsive Breakpoints', () => {
        const breakpoints = [375, 640, 768, 1024, 1280, 1536];

        for (const width of breakpoints) {
            test(`Layout at ${width}px should match snapshot`, async ({ page }) => {
                await page.setViewportSize({ width, height: 800 });
                await page.goto(`${BASE_URL}/`);
                await waitForPageStable(page, 'main');
                await hideDynamicElements(page);

                await expect(page).toHaveScreenshot(`responsive-${width}px.png`, {
                    ...SNAPSHOT_OPTIONS,
                    fullPage: false,
                });
            });
        }
    });
});

// Generate visual regression report
test.afterAll(async () => {
    console.log('\n📸 Visual Regression Tests Complete');
    console.log('===================================');
    console.log('To update baselines, run:');
    console.log('  pnpm test:e2e:update-snapshots');
});
