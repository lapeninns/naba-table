---
spec_id: MS-foundation-component-test-closure
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/components/**
implementation_surfaces:
  - micro-specs/foundation/component-test-closure.md
  - tests/components/**
related_docs:
  - docs/qa/full-suite.md
related_tests:
  - tests/components/features/tables/TableInventoryForm.test.tsx
  - tests/components/features/booking/detail/ReservationDetailView.test.tsx
  - tests/components/features/email-delivery/components/OpsEmailDeliveryLogTab.test.tsx
  - tests/components/features/ops-shell/OpsSidebarNav.test.tsx
  - tests/components/features/dashboard/BookingsList.test.tsx
  - tests/components/features/restaurant-settings/availability/WeeklyScheduleCard.test.tsx
  - tests/components/features/menu/menuHierarchyFormControls.test.tsx
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - The per-cluster inventory with behavioral/smoke classification per component.
approved_exceptions: []
---

# MS-foundation-component-test-closure — Close untested component gaps (behavioral wave)

## 1. Exact Goal and User-Visible Outcomes

The untested component surface (2026-07-11 audit: 377 of 548 components
unreferenced by any test) is closed cluster by cluster, interaction-bearing
components first. Priority order by risk: `src/components/features/booking`
(13 untested), `features/tables` (20), `features/email-delivery` (29),
`features/ops-shell` (12), `features/dashboard` (52), then
`features/restaurant-settings` (119), `features/menu` (28), root `components/ui`
(7), `src/components/landing` (15). When this wave ships, every untested component
in the completed clusters is either behaviorally tested (interactions, conditional
states, error/empty/loading states) or smoke-render tested with an explicit
`presentational` classification — zero unclassified. The inventory records exactly
which clusters this wave completed; remaining clusters roll into the next wave
under this same spec until the audit list is empty.

## 2. Blast Radius

In scope: new test files under `tests/components/**` (mirroring the source tree:
`tests/components/features/<cluster>/...`), this spec, and its evidence ledger.

Out of scope: ALL product source (defects reported, pinned as KNOWN-ISSUE, never
fixed here); existing component tests; hooks (own spec); e2e.

## 3. Strict Constraints and Assumptions

- Testing-library conventions copied from sibling suites (`render` +
  `screen`/`within`, `userEvent`, jest-dom matchers); Radix portals queried via
  role; mobile/desktop duplicate markup handled with `within()` scoping (the
  OpsEmailDeliveryClient lesson).
- Behavioral floor for interaction-bearing components: renders with representative
  props, each user interaction fires its callback/mutation (mocked), conditional
  states (loading/empty/error/disabled) render, and a11y basics (accessible
  name/role) hold.
- Smoke floor for presentational components: renders without throwing given
  representative props, snapshot-free (assert key text/roles, not markup dumps).
- Deterministic: fake timers where components schedule work; pinned system time
  for date-rendering components (the BookingListClient lesson); no host-TZ
  dependence.
- Tags accurate (`@contract`, `@a11y` where a11y is asserted); tag ratchet green.
- Enumerate untested components mechanically at implementation start (source tree
  vs references under `tests/`); the audit counts are the ballpark, the
  enumeration is the source of truth.

## 4. Decisions Already Made

- Cluster order is fixed as listed in the goal (booking → tables →
  email-delivery → ops-shell → dashboard → restaurant-settings → menu → ui →
  landing).
- One test file per component; index/barrel files and pure-type files are exempt
  and recorded as such.
- Components that are thin Radix/shadcn re-exports in `components/ui` get smoke +
  variant-prop assertions only.

## 5. Behavioral Requirements (EARS)

- THE inventory SHALL classify every untested component in the wave's clusters as
  behavioral, smoke/presentational, or exempt (barrel/type), with zero
  unclassified.
- THE interaction-bearing components SHALL meet the behavioral floor; THE
  presentational components SHALL meet the smoke floor.
- WHILE suites render date- or timer-dependent UI, THE suites SHALL pin time and
  stay deterministic under any TZ.
- IF a component test exposes a real product defect, THEN THE implementer SHALL
  pin current behavior with a KNOWN-ISSUE marker and report it.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- All new suites pass under `pnpm test`; full suite green; tag guard green.
- The reported inventory shows the completed clusters at 100% classified.
- All declared verification gates pass.

Tasks:

1. Wave A: booking, tables, email-delivery, ops-shell clusters.
2. Wave B: dashboard cluster.
3. Wave C: restaurant-settings cluster.
4. Wave D: menu, components/ui, landing.
5. Record gates per completed wave via
   `governance:run-gates --spec MS-foundation-component-test-closure --record`;
   advance lifecycle when the audit list is empty.
