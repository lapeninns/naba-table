---
task: fix-test-env-redirects
timestamp_utc: 2025-12-06T00:22:01Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm Playwright baseURL/host for tests. (Current logs show BASE_URL=http://localhost:3002)
- [x] Confirm env defaults (`NEXT_PUBLIC_ROOT_DOMAIN`, `VERCEL_URL`) under test runner. (Root domain comes from env; tests now read it dynamically.)

## Core

- [x] Update auth route tests to use env-driven root domain expectation.
- [x] Add/adjust mocks in ops occasions route test to prevent Supabase calls and 500 errors.
- [x] Review and adjust `middleware.ts` to allow Playwright wizard/booking traffic (no redirect loop). Normalizes localhost ports.
- [x] Align auth E2E fixture redirectUrl with expected booking path.

## Tests

- [x] Run targeted unit tests for auth and ops routes. (`pnpm vitest run src/app/api/auth/signin/route.test.ts src/app/api/auth/callback/route.test.ts src/app/api/ops/occasions/route.test.ts`)
- [ ] Run relevant Playwright test(s) to confirm redirect resolved.

## Notes

- Assumptions: No production behavioral changes; middleware adjustment scoped to test host/UA.
- Deviations: None yet.
- Batched Questions: baseURL/host details for Playwright; source of requireOpsAuth helper.
