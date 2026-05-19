# Onboarding QA

Sprint 11 adds a focused local entrypoint for public onboarding auth/session behavior, onboarding API boundaries, draft persistence, and shipped route smoke:

```sh
pnpm run qa:onboarding
```

The command runs:

- signup API contract tests for CSRF, field-level validation, safe onboarding callback paths, existing-account handling, and magic-link signup delivery mocks.
- onboarding restaurant creation security tests.
- onboarding context persistence tests that redact account secrets from `sessionStorage`.
- tenant-boundary tests for onboarding hours, services, zones, tables, and completion routes.
- app-host Playwright route smoke with `playwright.app.config.ts`, including the public entry, account-step field validation, mocked existing-account signup failure handling, guarded wrapper fallback, seeded wrapper routes, and mobile-width overflow proof.
- a command-composition QA test so the selector stays intentional.

This suite is local and mocked. It must not create live restaurants, send real auth emails, require production/staging access, or rely on uncontrolled sessions.
