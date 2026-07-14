---
spec_id: MS-foundation-test-baseline-restoration
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/server/**
  - tests/components/**
implementation_surfaces:
  - micro-specs/foundation/test-baseline-restoration.md
  - tests/server/public-booking-update-route.test.ts
  - tests/server/public-booking-delete-route.test.ts
  - tests/server/booking-validation-security.test.ts
  - tests/server/notifications/mobile-router.test.ts
  - tests/server/ops-occasions-route-security.test.ts
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
  - tests/components/BookingListClient.test.tsx
  - tests/components/OpsEmailDeliveryClient.test.tsx
  - tests/components/ReservationDetailClient.test.tsx
  - tests/components/RestaurantProfileSection.test.tsx
  - tests/server/capacity/planner-stress.test.ts
related_docs:
  - docs/qa/full-suite.md
  - docs/qa/foundation.md
related_tests:
  - tests/server/public-booking-update-route.test.ts
  - tests/server/public-booking-delete-route.test.ts
  - tests/server/booking-validation-security.test.ts
  - tests/components/BookingListClient.test.tsx
  - tests/components/OpsEmailDeliveryClient.test.tsx
  - tests/components/ReservationDetailClient.test.tsx
  - tests/components/RestaurantProfileSection.test.tsx
  - tests/server/capacity/planner-stress.test.ts
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

# MS-foundation-test-baseline-restoration — Restore green test baseline

## 1. Exact Goal and User-Visible Outcomes

`pnpm test` and `pnpm run qa:foundation` exit green on `main`, and the fixed tests can
no longer rot with the calendar. On 2026-07-11 the full suite had 11 failures in 6
files and the tag ratchet flagged 12 untagged titles in 3 files — none caught by CI.
Diagnosis (recorded in the task ledger): 9/11 are expired `2026-07-01` fixtures meeting
real-clock guards (`evaluateGuestModificationLock`, `assertBookingNotInPast`,
`bookingListDomain` past-bucketing, `useReservationDetailController`'s mount-effect
clock); 2/11 are single-element queries broken when the 2026-07-04 responsive redesign
duplicated queue-row text into a mobile card list; 1 additional failure surfaces after
the date fix because commit 4763635d's WhatsApp-consent patch calls `normalizePhone`,
which the route test's `@/server/customers` mock does not stub. Product behavior is
correct throughout — every fix is test-side.

## 2. Blast Radius

In scope: the six failing test files; the three tag-debt test files
(`notifications/mobile-router`, `ops-occasions-route-security`,
`twilio-whatsapp-status-webhook-route`); this spec and its evidence ledger.

Out of scope: all product source (the wall-clock guards behave correctly; threading an
injectable clock through `assertBookingNotInPast` / `evaluateGuestModificationLock` is
deliberate hygiene for a later spec), `config/qa/tag-baseline.json` (the ratchet is
satisfied by tagging, not by loosening the baseline), `vitest.config.ts`, all other
test files.

## 3. Strict Constraints and Assumptions

- No skipped, quarantined, or deleted tests: every failing assertion is fixed by
  pinning time or correcting the query/mock, preserving the behavior under test.
- Fixed tests must be deterministic under any host clock, host timezone, and CI's
  `TZ=UTC` — verified by running with a shifted `TZ`.
- Time pinning uses `vi.useFakeTimers()` + `vi.setSystemTime(...)` (restored after
  each test) or future-relative fixtures; pinned instants must sit consistently with
  each file's existing injected time providers (e.g. the update-route suite already
  injects now = 2026-05-16).
- Component suites that pin time must keep `@testing-library` interactions working
  (advance or opt real timers back in where user-event awaits).
- New/changed test titles must satisfy the tag audit (tag with allowed tags from
  `scripts/qa/tags.ts`; never raise untagged counts above baseline).
- Tests that legitimately exceed the global five-second budget under shared CI load keep every
  assertion and receive a narrow per-test 15-second timeout rather than a skip or suite-wide waiver.

## 4. Decisions Already Made

- Cluster A (update/delete route + booking-validation): pin system time so the
  `2026-07-01 19:00 Europe/London` fixtures are in the future again, matching the
  suites' injected providers; add `normalizePhone` to the `@/server/customers` mock as
  a passthrough-style stub alongside the existing `normalizeEmail`.
- Cluster B (`BookingListClient`): pin system time before the fixture date rather than
  rewriting fixture instants, so the timezone-rendering assertions ("19:30" in
  Europe/London) stay exact and DST-stable.
- Cluster C (`OpsEmailDeliveryClient`): scope queries with `within()` (or
  `getAllByText`) to the desktop table region; do not weaken the skeleton/refetch
  assertions themselves.
- Cluster D (`ReservationDetailClient`): pin system time (the controller's mount
  effect overwrites the injected `initialNow` by design, so `Date.now()` itself must
  be pinned).
- Tag debt: tag all 12 untagged titles in the three flagged files with accurate
  allowed tags (`@api`, `@security`, `@worker`, …); do not edit the baseline file.

## 5. Behavioral Requirements (EARS)

- THE full Vitest suite SHALL pass on a clean checkout regardless of the host date,
  clock, or timezone.
- WHEN the public booking update route test suite runs, THE session-recovery update
  scenarios SHALL exercise the WhatsApp-consent patch path with a mocked
  `normalizePhone` and assert HTTP 200 outcomes.
- WHEN the fixed suites execute under a shifted timezone (e.g. `TZ=America/New_York`),
  THE assertions SHALL still pass.
- WHILE the queue table renders both mobile-card and desktop-table markup, THE
  OpsEmailDeliveryClient tests SHALL target one region explicitly instead of relying
  on text uniqueness.
- THE three tag-debt files SHALL carry allowed `@` tags on every previously untagged
  title, and `pnpm run guard:qa-tags` SHALL pass.
- IF a fixed test's pinned clock is removed, THEN THE test SHALL fail rather than
  silently depend on the wall clock (pinning lives in the suite's setup, not ad hoc).

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `pnpm test` → 0 failures (≥3,374 tests, including 3 restored suites and the new
  consent-path assertion).
- `TZ=America/New_York pnpm exec vitest run <the six files>` → 0 failures.
- `pnpm run qa:foundation` → tag audit green with no baseline edits.
- `pnpm security:regression` → green (touched security suites intact).

Tasks:

1. Cluster A: pin time in the three server suites; extend the `@/server/customers`
   mock with `normalizePhone`; confirm the previously-masked consent-path failure is
   now exercised and green.
2. Cluster B/D: pin time in `BookingListClient` / `ReservationDetailClient` suites.
3. Cluster C: region-scope the `OpsEmailDeliveryClient` queries.
4. Tag the 12 untagged titles across the three flagged files.
5. Run the gates with `governance:run-gates --spec MS-foundation-test-baseline-restoration --record`;
   advance with `governance:advance`.
