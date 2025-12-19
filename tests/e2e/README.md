# E2E Tests

This directory contains end-to-end tests using [Playwright](https://playwright.dev/).

## Test Structure

```
tests/e2e/
├── fixtures/              # Shared test fixtures and helpers
│   └── auth.fixture.ts    # Authentication fixtures for guest/owner contexts
├── guest/                 # Guest-facing E2E tests
│   ├── booking-crud.spec.ts   # Booking lifecycle (create, read, update, delete)
│   ├── guest-routes.spec.ts   # Public + guest portal route coverage
│   ├── guest-redirects.spec.ts# Legacy redirect coverage
│   └── profile-crud.spec.ts   # Profile management
├── ops/                   # Restaurant ops E2E tests
│   ├── ops-routes.spec.ts     # Ops route coverage
│   └── ops-redirects.spec.ts  # Ops redirect coverage
├── accessibility/         # Accessibility audits (axe-core)
│   └── a11y-audit.spec.ts     # WCAG 2.1 AA compliance checks
├── visual/                # Visual regression tests
│   └── visual-regression.spec.ts  # Screenshot comparisons
└── README.md
```

## Running Tests

### Local Development

```bash
# Run all E2E tests with UI
pnpm test:e2e:ui

# Run guest-specific tests only
pnpm test:e2e:guest

# Run with specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit

# Run in headed mode (see browser)
pnpm exec playwright test --headed

# Run a specific test file
pnpm exec playwright test tests/e2e/guest/booking-crud.spec.ts

# Debug a specific test
pnpm exec playwright test tests/e2e/guest/booking-crud.spec.ts --debug
```

### CI Environment

Tests automatically run in GitHub Actions on:

- Push to `main`
- Pull requests

The CI workflow:

1. Builds the application
2. Starts the production server
3. Runs E2E tests in parallel (2 shards)
4. Uploads test reports as artifacts

## Test Coverage

### Guest Booking CRUD (`booking-crud.spec.ts`)

| Operation | Test                      | Status |
| --------- | ------------------------- | ------ |
| CREATE    | Create booking via wizard | ✅     |
| READ      | View booking details      | ✅     |
| UPDATE    | Modify party size         | ✅     |
| DELETE    | Cancel booking            | ✅     |
| VALIDATE  | Form validation           | ✅     |

### Guest Profile CRUD (`profile-crud.spec.ts`)

| Operation | Test                | Status |
| --------- | ------------------- | ------ |
| READ      | View profile        | ✅     |
| UPDATE    | Change name         | ✅     |
| A11Y      | Keyboard navigation | ✅     |
| A11Y      | Form labels         | ✅     |

### Guest Route Coverage (`guest-routes.spec.ts`)

| Area                  | Coverage                            | Status |
| --------------------- | ----------------------------------- | ------ |
| Public routes         | Home, Restaurants list/detail, Book | ✅     |
| Booking confirmations | /bookings/:id + thank-you → receipt | ✅     |
| Guest portal          | Dashboard + deprecated thank-you    | ✅     |

### Guest Redirects (`guest-redirects.spec.ts`)

| Route                   | Redirects To                  | Status |
| ----------------------- | ----------------------------- | ------ |
| `/signin`               | `/auth/signin`                | ✅     |
| `/browse`               | `/restaurants`                | ✅     |
| `/guest/bookings/:id`   | `/bookings/:id`               | ✅     |
| `/thank-you?bookingId=` | `/guest/bookings/:id/receipt` | ✅     |

### Ops Route Coverage (`ops-routes.spec.ts`)

| Area     | Coverage                                                           | Status |
| -------- | ------------------------------------------------------------------ | ------ |
| Core ops | Dashboard, bookings, new bookings, customers                       | ✅     |
| Settings | Profile, operating hours, service periods, occasions, team, tables | ✅     |

### Ops Redirects (`ops-redirects.spec.ts`)

| Route                         | Redirects To                   | Status |
| ----------------------------- | ------------------------------ | ------ |
| `/app/bookings` (main domain) | `app.<domain>/bookings`        | ✅     |
| `/app/bookings` (app host)    | `/bookings`                    | ✅     |
| `/settings`                   | `/settings/restaurant/profile` | ✅     |
| `/management`                 | `/settings/restaurant/team`    | ✅     |

## Environment Variables

| Variable                        | Description                              | Required in CI |
| ------------------------------- | ---------------------------------------- | -------------- |
| `BASE_URL`                      | App URL (default: http://localhost:3000) | ✅             |
| `E2E_TEST_GUEST_EMAIL`          | Test guest email                         | ✅             |
| `E2E_TEST_RESTAURANT_SLUG`      | Test restaurant                          | ✅             |
| `E2E_OPS_BASE_URL`              | Ops base URL (app subdomain)             | ✅             |
| `E2E_OPS_EMAIL`                 | Ops user email                           | ✅             |
| `E2E_OPS_PASSWORD`              | Ops user password                        | ✅             |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase URL                             | ✅             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                        | ✅             |

## GitHub Secrets Required

Add these secrets to your GitHub repository:

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
3. `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for seeding test data)
4. `E2E_BASE_URL` - Guest base URL (nabatable.com)
5. `E2E_TEST_TOKEN` - Shared token for guest E2E login API
6. `E2E_TEST_GUEST_EMAIL` - Email for test guest account
7. `E2E_TEST_GUEST_NAME` - Display name for guest account
8. `E2E_TEST_RESTAURANT_SLUG` - Restaurant slug for guest flows
9. `E2E_OPS_BASE_URL` - Ops base URL (app subdomain)
10. `E2E_OPS_EMAIL` - Ops user email
11. `E2E_OPS_PASSWORD` - Ops user password
12. `DRIFT_CHECK_DB_URL` - Database URL for schema drift checking

## Writing New Tests

1. Create a new `.spec.ts` file in the appropriate directory
2. Use the auth fixtures for authenticated contexts
3. Follow the AAA pattern (Arrange, Act, Assert)
4. Add appropriate timeouts for async operations
5. Use data-testid attributes for stable selectors

### Example Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/feature-page');

    // Act
    await page.getByRole('button', { name: 'Action' }).click();

    // Assert
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

## Debugging

### View Test Report

```bash
pnpm test:report
```

### Trace Viewer

For failed tests, Playwright captures traces. View them:

```bash
pnpm exec playwright show-trace test-results/*/trace.zip
```

### Screenshots & Videos

Failed tests automatically capture:

- Screenshots (in `test-results/`)
- Videos (in `test-results/`)

## CI Pipeline Overview

```
                              ┌─────────────────┐
                              │   Push / PR     │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │  🔍 Quality     │
                              │  Lint, Types,   │
                              │  Unit, Build    │
                              └────────┬────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
        ▼              ▼               ▼               ▼              ▼
┌───────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 🎭 E2E Tests  │ │ ♿ A11y     │ │ ⚡ Lighthouse│ │ 📸 Visual   │ │ 🔒 Security │
│  (Shards 1-2) │ │ Axe Audit  │ │ Performance │ │ Regression  │ │ Scans       │
└───────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
        │              │               │               │              │
        └──────────────┴───────────────┴───────────────┴──────────────┘
                                       │
                              ┌────────▼────────┐
                              │ 📊 Test Summary │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
           (if PR)                               (if main branch)
    ┌─────────────────────┐              ┌─────────────────────┐
    │ 🔗 Preview Deploy   │              │ 🚀 Deploy Gate      │
    │ Every PR gets URL   │              │ Ready for prod!     │
    └─────────────────────┘              └─────────────────────┘
```

### Test Types

| Job                  | What It Tests            | Passes When                      |
| -------------------- | ------------------------ | -------------------------------- |
| 🎭 **E2E Tests**     | Guest CRUD, booking flow | All functional tests pass        |
| ♿ **Accessibility** | WCAG 2.1 AA compliance   | Zero critical/serious violations |
| ⚡ **Lighthouse**    | FCP, LCP, CLS, TBT       | Meets performance budgets        |
| 📸 **Visual**        | Screenshot comparisons   | No unintended UI changes         |
| 🔒 **Security**      | Secrets, dependencies    | No leaks, no vulnerabilities     |

### Performance Budgets (enforced)

| Metric                   | Budget  | Source    |
| ------------------------ | ------- | --------- |
| First Contentful Paint   | ≤ 2.0s  | AGENTS.md |
| Largest Contentful Paint | ≤ 2.5s  | AGENTS.md |
| Cumulative Layout Shift  | ≤ 0.10  | AGENTS.md |
| Total Blocking Time      | ≤ 200ms | AGENTS.md |

## Troubleshooting

### Tests fail with "page not found"

Ensure the dev server is running:

```bash
pnpm dev
```

### Authentication issues

Check that test user exists in the database and magic link settings are correct.

### Flaky tests

1. Increase timeouts for slow operations
2. Add explicit waits for dynamic content
3. Use more specific selectors

### CI failures

1. Check GitHub Actions logs
2. Download test artifacts (screenshots, videos)
3. Review Playwright report in artifacts
