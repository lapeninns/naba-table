---
spec_id: MS-foundation-server-module-test-closure
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/server/**
  - tests/lib/**
implementation_surfaces:
  - micro-specs/foundation/server-module-test-closure.md
  - tests/server/emails/monthly-report.test.ts
  - tests/server/reports/monthly-venue-report.test.ts
  - tests/server/jobs/monthly-venue-report.test.ts
  - tests/server/jobs/table-scarcity.test.ts
  - tests/server/capacity/rotations.test.ts
  - tests/server/capacity/strategic-config.test.ts
  - tests/server/capacity/v2-supabase-repository.test.ts
  - tests/server/outbox.test.ts
  - tests/server/ops/operations-hub-domain.test.ts
  - tests/server/google-business-profile/client-location-profile.test.ts
  - tests/server/google-business-profile/service-public.test.ts
  - tests/server/google-business-profile/client-auth.test.ts
  - tests/server/google-business-profile/workflow-publish-retry-service.test.ts
  - tests/server/google-business-profile/food-menus-import-decisions.test.ts
  - tests/server/google-business-profile/food-menus-publish-service.test.ts
  - tests/server/google-business-profile/food-menus-import-review-service.test.ts
  - tests/server/dual-sync/google-patch-builders.test.ts
  - tests/lib/restaurants/email-template-defaults.test.ts
related_docs:
  - docs/qa/full-suite.md
related_tests:
  - tests/server/emails/monthly-report.test.ts
  - tests/server/reports/monthly-venue-report.test.ts
  - tests/server/jobs/monthly-venue-report.test.ts
  - tests/server/jobs/table-scarcity.test.ts
  - tests/server/capacity/rotations.test.ts
  - tests/server/capacity/strategic-config.test.ts
  - tests/server/capacity/v2-supabase-repository.test.ts
  - tests/server/outbox.test.ts
  - tests/server/ops/operations-hub-domain.test.ts
  - tests/server/google-business-profile/client-location-profile.test.ts
  - tests/server/google-business-profile/service-public.test.ts
  - tests/server/google-business-profile/client-auth.test.ts
  - tests/server/google-business-profile/workflow-publish-retry-service.test.ts
  - tests/server/google-business-profile/food-menus-import-decisions.test.ts
  - tests/server/google-business-profile/food-menus-publish-service.test.ts
  - tests/server/google-business-profile/food-menus-import-review-service.test.ts
  - tests/server/dual-sync/google-patch-builders.test.ts
  - tests/lib/restaurants/email-template-defaults.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-foundation-server-module-test-closure — Close untested server/lib module gaps

## 1. Exact Goal and User-Visible Outcomes

The largest untested server/lib modules (2026-07-11 audit: 160 of 578 modules have no
referencing test) gain behavioral unit tests. This wave covers the top-risk clusters:
the monthly-venue-report trio (`server/emails/monthly-report.ts`,
`server/reports/monthly-venue-report.ts`, `server/jobs/monthly-venue-report.ts` — a
live feature with previously-observed pipeline bugs), capacity logic
(`rotations.ts`, `strategic-config.ts`, `v2/supabase-repository.ts`), the outbox
(`server/outbox.ts`), `jobs/table-scarcity.ts`, `ops/operations-hub.ts` domain
logic, the Google Business Profile service cluster (7 modules), dual-sync
`google-patch-builders.ts`, and `lib/restaurants/email-template-defaults.ts`. When
this ships, each module's core behaviors and edge cases (empty inputs, boundary
dates, error paths, tenant scoping) are pinned by mocked Vitest suites.

## 2. Blast Radius

In scope: new test files under `tests/server/**` and `tests/lib/**` only (listed in
`implementation_surfaces`), this spec, and its evidence ledger.

Out of scope: ALL product source — if a test exposes a real defect (the
monthly-report pipeline is a known suspect: delivered-webhook rows, stale
`first_booking_at`, missing cancel history), assert the CURRENT actual behavior with
a clearly-marked `// KNOWN-ISSUE:` comment and report it for a product-fix spec —
do not encode wished-for behavior that fails, and do not patch product code here;
existing test files; types-only modules (`food-menus-types.ts`) and replay fixtures
(`fake-google.ts`) are explicitly excluded as non-behavioral.

## 3. Strict Constraints and Assumptions

- Mock at module seams (Supabase client factories from `server/supabase.ts`,
  provider HTTP clients, `sendEmail`) exactly as sibling suites do; no network, no
  real DB.
- Every suite is deterministic: pin time with fake timers for anything
  date-dependent (monthly boundaries, scarcity windows, retry backoff), and cover
  timezone-sensitive month-boundary edges (e.g. report month rollover) explicitly.
- Tag every title accurately (`@contract`, plus `@worker` for jobs, `@security`
  for tenant-scoping assertions); tag ratchet stays green.
- Edge-case floor per module: happy path, empty/zero-data path, malformed/partial
  input, error propagation from the mocked boundary, and (where applicable)
  tenant-scoping (`restaurant_id` respected by service-role paths).

## 4. Decisions Already Made

- One test file per module (grouped only where the module is a thin sibling);
  file locations mirror source paths.
- `sendEmail` boundary asserted by args (fromName, to, subject shape), never sent.
- Known-issue behaviors are pinned as-is with `// KNOWN-ISSUE:` comments and
  surfaced in the implementation report (they become the backlog for product-fix
  specs).

## 5. Behavioral Requirements (EARS)

- THE listed modules SHALL each have a behavioral test suite meeting the edge-case
  floor.
- WHEN a suite pins a suspected-defective behavior, THE suite SHALL mark it
  `KNOWN-ISSUE` and the implementer SHALL report it rather than change product
  code.
- WHILE suites run under any host clock or timezone, THE assertions SHALL be
  deterministic.
- THE new test titles SHALL carry accurate allowed tags and keep the tag ratchet
  green.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- All new suites pass under `pnpm test`; full suite green; tag guard green.
- Each listed source module is imported by its new suite (real coverage, not
  nominal).
- All declared verification gates pass.

Tasks:

1. Monthly-report trio + jobs (report/email/cron-job seams, month boundaries).
2. Capacity cluster + outbox (rotation math, strategic config, repository mapping,
   outbox claim/retry semantics).
3. GBP cluster + dual-sync patch builders + email-template defaults.
4. Record gates via `governance:run-gates --spec MS-foundation-server-module-test-closure --record`;
   advance lifecycle.
