---
spec_id: MS-foundation-api-route-test-closure
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/server/**
implementation_surfaces:
  - micro-specs/foundation/api-route-test-closure.md
  - tests/server/config-service-policy-route.test.ts
  - tests/server/ops-operations-hub-route.test.ts
  - tests/server/ops-strategies-simulate-route.test.ts
  - tests/server/cron-monthly-venue-report-route.test.ts
  - tests/server/ops-team-memberships-route.test.ts
  - tests/server/ops-settings-strategic-config-route.test.ts
  - tests/server/auth/signout-route.test.ts
  - tests/server/ops-zones-routes.test.ts
  - tests/server/ops-bookings-status-summary-route.test.ts
  - tests/server/ops-booking-manual-context-route.test.ts
  - tests/server/onboarding-restaurant-step-routes.test.ts
related_docs:
  - docs/qa/full-suite.md
related_tests:
  - tests/server/config-service-policy-route.test.ts
  - tests/server/ops-operations-hub-route.test.ts
  - tests/server/ops-strategies-simulate-route.test.ts
  - tests/server/cron-monthly-venue-report-route.test.ts
  - tests/server/ops-team-memberships-route.test.ts
  - tests/server/auth/signout-route.test.ts
  - tests/server/ops-settings-strategic-config-route.test.ts
  - tests/server/ops-zones-routes.test.ts
  - tests/server/ops-bookings-status-summary-route.test.ts
  - tests/server/ops-booking-manual-context-route.test.ts
  - tests/server/onboarding-restaurant-step-routes.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
  - pnpm security:regression
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-foundation-api-route-test-closure — Close untested API route gaps

## 1. Exact Goal and User-Visible Outcomes

Every shipped API route handler has a behavioral route test. The 2026-07-11 audit
found these route files with no dedicated test (only source-scans or indirect e2e
mentions): `api/config/service-policy`, `api/ops/operations-hub`,
`api/ops/strategies/simulate`, `api/cron/monthly-venue-report`,
`api/ops/team/memberships`, `api/ops/settings/strategic-config`, `api/auth/signout`,
`api/ops/zones` + `api/ops/zones/[id]`, `api/ops/bookings/status-summary`,
`api/ops/bookings/[id]/manual-context`, and the five onboarding per-step routes
(`onboarding/restaurant/[id]/{complete,hours,service-periods,tables,zones}`). When
this ships, each has a mocked Vitest route test covering the happy path, the
authorization/negative path, and the malformed-input path — the standing edge-case
floor for every route in this repo.

## 2. Blast Radius

In scope: new test files under `tests/server/**` only (one per route or logical
route group, listed in `implementation_surfaces`), this spec, and its evidence
ledger.

Out of scope: ALL product source — if a test reveals a real product bug, STOP and
surface it for a separate product-fix spec rather than bending the test or patching
the route here; the harness/dev-only route
`(public)/dev/api/restaurant-email-template-preview` (harness routes are
supplemental by AGENTS.md and excluded from this closure); existing test files.

## 3. Strict Constraints and Assumptions

- Follow the repo's established route-test pattern (`vi.hoisted` + `vi.mock` of the
  Supabase server client modules, `NextRequest` invocation of the exported handler,
  assertion on status + JSON body) — copy conventions from the nearest sibling test
  (e.g. `ops-tables-route-security.test.ts`, `restaurant-details-route.test.ts`).
- Tests are fully mocked and offline; no test may weaken the mutation-boundary
  expectations (RLS-scoped client vs security-definer RPC vs service-role — assert
  the route calls the boundary the code actually uses).
- Every route test asserts at minimum: (1) happy path, (2) unauthenticated and/or
  cross-tenant rejection (401/403), (3) invalid-input rejection (400/422) where the
  route parses input; cron routes assert the cron-secret/auth guard both ways.
- Every new test title carries accurate `@` tags (`@api` plus `@security` where the
  assertion is an auth boundary); the tag ratchet must stay green.
- The suite must remain deterministic (no wall-clock dependence — pin time if a
  route computes against now).

## 4. Decisions Already Made

- One test file per route, except: the two zones routes share
  `ops-zones-routes.test.ts`; the five onboarding step routes share
  `onboarding-restaurant-step-routes.test.ts` (same auth model, table-driven).
- Existing indirect coverage (e2e mentions, source-scan tests) stays untouched;
  these new files are the behavioral source of truth.
- `manual-context` gets a dedicated route test even though domain logic is covered
  by `capacity/manual-assignment-context-holds.test.ts` — the route's auth +
  serialization boundary is what's untested.

## 5. Behavioral Requirements (EARS)

- THE repository SHALL contain a behavioral route test for every non-harness API
  route listed in the goal.
- WHEN each new route suite runs, THE suite SHALL assert happy, auth-rejection, and
  invalid-input paths for its route.
- WHERE a route mutates state, THE test SHALL assert the mutation goes through the
  route's actual mutation-boundary layer (mocked at that seam).
- IF a new test exposes a genuine product defect, THEN THE implementer SHALL stop
  and surface it rather than modify product code under this spec.
- THE new test titles SHALL carry accurate allowed tags and keep
  `pnpm run guard:qa-tags` green.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- All new suites pass under `pnpm test`; full suite stays green; tag guard green.
- Each listed route file name appears in at least one new test's imports (the
  route-to-test mapping is real, not nominal).
- All declared verification gates pass.

Tasks (test-first by nature):

1. Inventory each route's handler exports, auth model, and mutation boundary.
2. Write the 11 test files (happy/auth/invalid per route; table-driven where
   grouped).
3. Run the gates with `governance:run-gates --spec MS-foundation-api-route-test-closure --record`;
   advance with `governance:advance`.
