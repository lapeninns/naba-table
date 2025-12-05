/**
 * Lighthouse CI Configuration
 *
 * Enforces performance, accessibility, best practices, and SEO budgets.
 * Runs on CI to block deployments that don't meet quality thresholds.
 *
 * @see https://github.com/GoogleChrome/lighthouse-ci
 */

module.exports = {
    ci: {
        collect: {
            // URLs to audit
            url: [
                'http://localhost:3000/',
                'http://localhost:3000/auth/signin',
                'http://localhost:3000/restaurants/white-horse-pub-waterbeach',
            ],
            // Number of runs per URL (takes median)
            numberOfRuns: 3,
            // Start server command
            startServerCommand: 'pnpm start',
            startServerReadyPattern: 'ready',
            startServerReadyTimeout: 30000,
            // Puppeteer settings
            settings: {
                preset: 'desktop',
                // Throttle to simulate real conditions
                throttling: {
                    cpuSlowdownMultiplier: 2,
                },
                // Chrome flags
                chromeFlags: '--no-sandbox --disable-gpu --headless',
                // Categories to audit
                onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            },
        },
        assert: {
            // Assertion presets
            preset: 'lighthouse:recommended',
            assertions: {
                // ============================================
                // PERFORMANCE BUDGETS (based on your AGENTS.md)
                // ============================================

                // First Contentful Paint ≤ 2.0s
                'first-contentful-paint': ['error', { maxNumericValue: 2000 }],

                // Largest Contentful Paint ≤ 2.5s
                'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],

                // Cumulative Layout Shift ≤ 0.10
                'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

                // Total Blocking Time ≤ 200ms
                'total-blocking-time': ['error', { maxNumericValue: 200 }],

                // Speed Index ≤ 3.0s
                'speed-index': ['warn', { maxNumericValue: 3000 }],

                // Interactive ≤ 3.5s
                'interactive': ['warn', { maxNumericValue: 3500 }],

                // ============================================
                // CATEGORY SCORES (0-100)
                // ============================================

                // Performance: Minimum 85
                'categories:performance': ['error', { minScore: 0.85 }],

                // Accessibility: Minimum 95 (high bar)
                'categories:accessibility': ['error', { minScore: 0.95 }],

                // Best Practices: Minimum 90
                'categories:best-practices': ['error', { minScore: 0.9 }],

                // SEO: Minimum 90
                'categories:seo': ['error', { minScore: 0.9 }],

                // ============================================
                // SPECIFIC AUDITS
                // ============================================

                // Images
                'uses-responsive-images': 'warn',
                'uses-optimized-images': 'warn',
                'uses-webp-images': 'warn',
                'image-size-responsive': 'warn',

                // JavaScript
                'unused-javascript': 'warn',
                'unminified-javascript': 'error',
                'legacy-javascript': 'warn',

                // CSS
                'unused-css-rules': 'warn',
                'unminified-css': 'error',

                // Resources
                'render-blocking-resources': 'warn',
                'uses-text-compression': 'error',

                // Accessibility (critical)
                'document-title': 'error',
                'html-has-lang': 'error',
                'meta-description': 'error',
                'meta-viewport': 'error',
                'color-contrast': 'warn',
                'heading-order': 'warn',
                'link-name': 'error',
                'button-name': 'error',
                'image-alt': 'error',
                'label': 'error',

                // Security
                'is-on-https': 'off', // Off for localhost testing
                'uses-http2': 'off', // Off for localhost testing

                // PWA (optional)
                'installable-manifest': 'off',
                'splash-screen': 'off',
                'themed-omnibox': 'off',
                'content-width': 'warn',
                'viewport': 'error',

                // SEO
                'robots-txt': 'off', // May not exist in dev
                'canonical': 'warn',
                'hreflang': 'off',
            },
        },
        upload: {
            // Upload to temporary public storage (7 days)
            target: 'temporary-public-storage',
        },
        server: {
            // Lighthouse CI server settings (for historical tracking)
            // Uncomment if you have LHCI server set up
            // target: 'lhci',
            // serverBaseUrl: 'https://your-lhci-server.herokuapp.com',
        },
    },
};
