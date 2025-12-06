---
task: fix-test-env-redirects
timestamp_utc: 2025-12-06T00:22:01Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Stabilize test env domains & redirects

## Requirements

- Functional:
  - Unit tests for auth routes use the same root domain as the code under test (no localhost vs prod mismatch).
  - Ops occasions API tests do not crash (mock requireOpsAuth and supabase interactions correctly).
  - E2E Playwright flow can load Wizard/booking pages without middleware redirecting to home.
  - E2E auth fixture returns redirectUrl that matches test expectations (e.g., /guest/bookings) and does not bounce to home.
- Non-functional:
  - Keep behavior unchanged for real production traffic; fixes should be test-env scoped.
  - Avoid secrets in code; respect remote-only DB rules.
  - Maintain existing routing/auth patterns.

## Existing Patterns & Reuse

- Next.js App Router with middleware-based routing/redirect rules in `src/middleware.ts`.
- Vitest unit tests under `src/app/api/**` already import helpers; auth tests currently hardcode localhost domain strings.
- Playwright config likely sets `baseURL`; auth fixture uses `/api/auth/e2e-login` to sign in.
- Ops auth helper `requireOpsAuth` should be mocked in tests to avoid Supabase calls.

## External Resources

- None required beyond repo context; no external specs referenced.

## Constraints & Risks

- Changing middleware logic could affect production traffic; ensure changes are gated to test/dev hosts or user agents.
- Env var changes must not leak into production defaults; ensure defaults remain safe (no localhost in prod).
- Mocking `requireOpsAuth` must not hide genuine auth regressions; scope mocks only to tests.
- Playwright baseURL/host must stay aligned with middleware allowlist to avoid new redirect loops.

## Open Questions (owner, due)

- What is the current Playwright `baseURL` and test hostname/port? (owner: assistant, due: before coding) → Observed via `test_output_14.log`: BASE_URL resolves to `http://localhost:3002` in current runs.
- What domain does auth code prefer when `NEXT_PUBLIC_ROOT_DOMAIN` vs `VERCEL_URL` are set in tests? (owner: assistant, due: before coding) → `NEXT_PUBLIC_ROOT_DOMAIN` drives redirect sanitization; hostname from the request drives callback base. Tests now derive expectations from env to avoid localhost/prod drift.
- Does `requireOpsAuth` have an existing test mock helper? (owner: assistant, due: before coding) → No dedicated helper; unit test now stubs Supabase auth and `fetchAllOccasions` directly.

## Recommended Direction (with rationale)

- Use env-driven expectations in auth tests (Option A from summary): assert against `process.env.NEXT_PUBLIC_ROOT_DOMAIN` instead of hardcoded localhost, reducing drift between env and tests.
- In ops occasions test, mock `requireOpsAuth`/Supabase client to return a valid user and avoid DB calls, preventing 500.
- Inspect `middleware.ts` to adjust host/ua allowlist so Playwright traffic to `/restaurants/.../book` or wizard paths is not redirected; keep production rules intact.
- Verify/update Playwright `baseURL` and auth fixture redirectUrl to align (likely `http://localhost:3000/guest/bookings`).

## Definition of Ready checklist

- [x] Scope & success criteria clear and measurable
- [x] Reuse/"no reusable pattern" documented
- [x] Risks & open questions listed with owners
- [x] Owner & reviewers assigned
