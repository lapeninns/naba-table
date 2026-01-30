/**
 * Accessibility E2E Tests
 *
 * Automated WCAG compliance checks using axe-core.
 * These tests run on every page to ensure accessibility standards are met.
 *
 * Standards: WCAG 2.1 AA
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Pages to test for accessibility
const GUEST_PAGES = [
    { path: '/', name: 'Home Page' },
    { path: '/auth/signin', name: 'Sign In Page' },
    { path: '/restaurants/white-horse-pub-waterbeach', name: 'Restaurant Page' },
    { path: '/guest/bookings', name: 'Guest Bookings' },
    { path: '/guest/profile', name: 'Guest Profile' },
];

// Axe rules configuration
const AXE_OPTIONS = {
    // WCAG 2.1 AA compliance
    runOnly: {
        type: 'tag' as const,
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
    // Elements to exclude (third-party widgets, etc.)
    exclude: [
        ['iframe'], // Third-party iframes
        ['[data-crisp-widget]'], // Crisp chat widget
    ],
};

// Violations to ignore (false positives or known issues to fix later)
const IGNORED_VIOLATIONS: string[] = [
    // Add any rule IDs to temporarily ignore
    // 'color-contrast', // Example: if you have known contrast issues
];

test.describe('Accessibility Audits', () => {
    test.setTimeout(60_000);

    for (const { path, name } of GUEST_PAGES) {
        test(`${name} should have no critical accessibility violations`, async ({
            page,
        }) => {
            // Navigate to page
            await page.goto(`${BASE_URL}${path}`);
            await page.waitForLoadState('networkidle');

            // Run axe accessibility scan
            const accessibilityScanResults = await new AxeBuilder({ page })
                .options(AXE_OPTIONS)
                .analyze();

            // Filter out ignored violations
            const violations = accessibilityScanResults.violations.filter(
                (v) => !IGNORED_VIOLATIONS.includes(v.id)
            );

            // Categorize by impact
            const critical = violations.filter((v) => v.impact === 'critical');
            const serious = violations.filter((v) => v.impact === 'serious');
            const moderate = violations.filter((v) => v.impact === 'moderate');

            // Log violations for debugging
            if (violations.length > 0) {
                console.log(`\n⚠️ Accessibility issues on ${name}:`);
                violations.forEach((v) => {
                    console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.help}`);
                    console.log(`    ${v.helpUrl}`);
                    v.nodes.slice(0, 3).forEach((node) => {
                        console.log(`    - ${node.target.join(' > ')}`);
                    });
                });
            }

            // Store results as test annotation
            test.info().annotations.push({
                type: 'a11y_summary',
                description: JSON.stringify({
                    page: path,
                    total: violations.length,
                    critical: critical.length,
                    serious: serious.length,
                    moderate: moderate.length,
                }),
            });

            // Fail on critical or serious violations
            expect(
                critical,
                `Critical accessibility violations found on ${name}`
            ).toHaveLength(0);

            expect(
                serious,
                `Serious accessibility violations found on ${name}`
            ).toHaveLength(0);

            // Warn on moderate violations but don't fail
            if (moderate.length > 0) {
                console.warn(
                    `⚠️ ${moderate.length} moderate accessibility issues on ${name}`
                );
            }
        });
    }

    test('Guest booking dialog should be accessible', async ({ page }) => {
        // Navigate to restaurant page
        await page.goto(`${BASE_URL}/restaurants/white-horse-pub-waterbeach`);
        await page.waitForLoadState('networkidle');

        // Open booking dialog
        const bookButton = page.getByRole('button', { name: /book|reserve/i }).first();
        if (await bookButton.isVisible({ timeout: 5_000 })) {
            await bookButton.click();
            await page.waitForTimeout(1_000);
        }

        // Scan the dialog
        const dialogResults = await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .options(AXE_OPTIONS)
            .analyze();

        const dialogViolations = dialogResults.violations.filter(
            (v) => !IGNORED_VIOLATIONS.includes(v.id) && v.impact !== 'minor'
        );

        expect(
            dialogViolations,
            'Booking dialog has accessibility violations'
        ).toHaveLength(0);
    });

    test('Forms should have proper labels and error handling', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/signin`);
        await page.waitForLoadState('networkidle');

        // Check form accessibility
        const formResults = await new AxeBuilder({ page })
            .include('form')
            .options({
                runOnly: {
                    type: 'rule',
                    values: [
                        'label',
                        'label-title-only',
                        'form-field-multiple-labels',
                        'autocomplete-valid',
                    ],
                },
            })
            .analyze();

        expect(formResults.violations).toHaveLength(0);
    });

    test('Keyboard navigation should work on all interactive elements', async ({
        page,
    }) => {
        await page.goto(`${BASE_URL}/`);
        await page.waitForLoadState('networkidle');

        // Get all focusable elements
        const focusableElements = await page.$$eval(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
            (els) =>
                els
                    .filter((el) => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    })
                    .map((el) => ({
                        tag: el.tagName.toLowerCase(),
                        text:
                            (el as HTMLElement).innerText?.slice(0, 50) ||
                            el.getAttribute('aria-label') ||
                            '',
                    }))
        );

        // Tab through elements and verify focus is visible
        for (let i = 0; i < Math.min(10, focusableElements.length); i++) {
            await page.keyboard.press('Tab');

            const focusedElement = page.locator(':focus');
            await expect(focusedElement).toBeVisible();

            // Check for visible focus indicator
            const hasVisibleFocus = await focusedElement.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                const outline = styles.outline;
                const boxShadow = styles.boxShadow;
                return outline !== 'none' || boxShadow !== 'none';
            });

            expect(hasVisibleFocus).toBeTruthy();
        }
    });

    test('Images should have alt text', async ({ page }) => {
        await page.goto(`${BASE_URL}/`);
        await page.waitForLoadState('networkidle');

        const imagesWithoutAlt = await page.$$eval('img', (images) =>
            images
                .filter((img) => !img.alt && !img.getAttribute('aria-hidden'))
                .map((img) => img.src)
        );

        expect(
            imagesWithoutAlt,
            `Images without alt text: ${imagesWithoutAlt.join(', ')}`
        ).toHaveLength(0);
    });

    test('Color contrast should meet WCAG AA standards', async ({ page }) => {
        await page.goto(`${BASE_URL}/`);
        await page.waitForLoadState('networkidle');

        const contrastResults = await new AxeBuilder({ page })
            .options({
                runOnly: {
                    type: 'rule',
                    values: ['color-contrast', 'color-contrast-enhanced'],
                },
            })
            .analyze();

        const failingContrast = contrastResults.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical'
        );

        if (failingContrast.length > 0) {
            console.log('Color contrast issues:');
            failingContrast[0]?.nodes.slice(0, 5).forEach((node) => {
                console.log(`  - ${node.target.join(' > ')}`);
                console.log(`    ${node.failureSummary}`);
            });
        }

        expect(failingContrast).toHaveLength(0);
    });
});

// Helper to generate accessibility report
test.afterAll(async () => {
    console.log('\n📊 Accessibility Audit Complete');
    console.log('===============================');
    console.log('Standards: WCAG 2.1 AA');
    console.log(`Pages tested: ${GUEST_PAGES.length}`);
});
