# Testing Guide

Last updated: 2026-01-29

## Overview

This document describes testing strategy, conventions, and policies for the SajiloReserveX codebase.

## Test Types

- **Unit tests**: Vitest tests for functions, utilities, and components (`*.test.ts`, `*.test.tsx`)
- **Integration tests**: API route tests with mocked dependencies (`src/app/api/**/*.test.ts`)
- **E2E tests**: Playwright tests for critical user flows (`tests/e2e/**/*.spec.ts`)
- **Component tests**: Playwright component tests for UI components (`*.component.spec.tsx`)
- **Accessibility tests**: Axe checks within E2E suites (`tests/e2e/accessibility/*.spec.ts`)

## Running Tests

```bash
# Unit and integration tests
pnpm test                    # Run all Vitest tests
pnpm test:coverage           # Run with coverage report

# E2E tests
pnpm test:e2e                # Run all Playwright E2E tests
pnpm test:e2e:ui             # Open Playwright UI for debugging

# Component tests
pnpm test:component          # Run Playwright component tests

# Quality checks
pnpm test:quality            # Enforce test naming and no .only/.skip
```

## Test Isolation Policy

**All tests must be isolated and idempotent.** Each test should:

1. **Not depend on execution order** — tests must pass individually and when run in any order
2. **Clean up side effects** — restore mocks, clear timers, reset modules after each test
3. **Use independent fixtures** — avoid shared mutable state between tests
4. **Mock external dependencies** — network calls, databases, third-party APIs
5. **Avoid test pollution** — use `beforeEach`/`afterEach` to reset state

### Vitest Isolation

Vitest provides process-level isolation via test pools:

- **Default pool**: `forks` (each test file runs in a separate child process)
- **Configured in**: `vitest.config.ts` → `pool: 'forks'`
- **Benefits**: Tests cannot leak state between files; failures are isolated

### Best Practices

```typescript
// ✅ Good: Isolated test with cleanup
describe('BookingService', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = createMockDatabase();
  });

  afterEach(() => {
    mockDb.cleanup();
    vi.clearAllMocks();
  });

  it('creates a booking', async () => {
    const booking = await createBooking(mockDb, {
      /* ... */
    });
    expect(booking).toBeDefined();
  });
});

// ❌ Bad: Shared mutable state
const sharedBookings = []; // Leaks between tests
it('adds booking', () => sharedBookings.push({})); // Pollution
it('counts bookings', () => expect(sharedBookings).toHaveLength(1)); // Order-dependent
```

### Enforcing Isolation

- **Automated checks**: `pnpm test:quality` bans `.only` and `.skip` to prevent accidental test skipping
- **Coverage thresholds**: `vitest.config.ts` enforces minimum coverage (80% lines, 75% branches)
- **CI validation**: All tests run in parallel; failures indicate isolation issues

## Test Naming Conventions

- Use `.test.ts` or `.spec.ts` for unit/integration tests
- Use `.spec.ts` for E2E tests (enforced by `scripts/tests/check-test-quality.ts`)
- Use descriptive `describe` blocks matching the module/component under test
- Use imperative `it` statements: "should create booking", "renders loading state"

## Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  lines: 80,
  functions: 75,
  branches: 75,
  statements: 80,
}
```

Run `pnpm test:coverage` to generate coverage reports in `coverage/`.

## Debugging Tests

```bash
# Run a specific test file
pnpm vitest path/to/test.test.ts

# Watch mode for iterative development
pnpm vitest --watch

# Debug in VS Code (use "JavaScript Debug Terminal")
pnpm vitest --inspect-brk

# Playwright UI mode for E2E
pnpm test:e2e:ui
```

## CI Integration

Tests run automatically on every PR via `.github/workflows/ci.yml`:

- **Quality job**: Lint, typecheck, test quality checks
- **Unit/integration**: `pnpm test` with coverage
- **E2E**: `pnpm test:e2e` in parallel shards
- **Accessibility**: `pnpm test:e2e tests/e2e/accessibility`

## References

- [Vitest docs](https://vitest.dev/)
- [Playwright docs](https://playwright.dev/)
- [Testing Library best practices](https://testing-library.com/docs/guiding-principles/)
