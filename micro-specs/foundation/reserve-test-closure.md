---
spec_id: MS-foundation-reserve-test-closure
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/reserve/**
implementation_surfaces:
  - micro-specs/foundation/reserve-test-closure.md
  - tests/reserve/**
related_docs:
  - docs/qa/reserve-app.md
related_tests:
  - tests/reserve/features/reservations/wizard/model/reducer.test.ts
  - tests/reserve/features/reservations/wizard/hooks/useDetailsStepForm.test.tsx
  - tests/reserve/features/reservations/wizard/ui/BookingWizard.test.tsx
  - tests/reserve/features/reservations/wizard/ui/steps/DetailsStep.test.tsx
  - tests/reserve/shared/config/env.test.ts
  - tests/reserve/shared/time/date.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - The enumerated reserve-module inventory with per-file classification.
approved_exceptions: []
---

# MS-foundation-reserve-test-closure — Close untested reserve sub-app gaps

## 1. Exact Goal and User-Visible Outcomes

The reserve wizard (the guest-facing Vite sub-app: 129 source files across
`reserve/features` 65, `reserve/shared` 48, `reserve/pages` 5, `reserve/app` 4,
`reserve/entities` 2) reaches the same classified-coverage standard as the main
app. The 2026-07-11 audit found only 22 unit test files (~17% file coverage), with
the `reserve/features` tree — the booking wizard's steps, validation, and
draft/session logic — largely untested. When this ships, every reserve source file
is classified (behavioral / smoke / exempt) and every logic-bearing module or
component has a suite meeting the same floors as the main-app closure specs.

## 2. Blast Radius

In scope: new test files under `tests/reserve/**` (mirroring the reserve source
layout), this spec, and its evidence ledger.

Out of scope: ALL product source (KNOWN-ISSUE policy applies); existing
`tests/reserve` suites; the `guest-reserve-routes.spec.ts` e2e (already exists);
Storybook stories; the reserve build config.

## 3. Strict Constraints and Assumptions

- Reserve tests use the same Vitest/jsdom setup as the rest of `tests/`
  (`@reserve`/`@features`/`@shared`/`@entities` aliases are already wired in
  `vitest.config.ts`); copy conventions from existing `tests/reserve/*` suites
  (e.g. `buildReservationDraft.test.ts`, `review-step-capacity-error.test.tsx`).
- Behavioral floor: wizard-step components exercise selection → validation →
  advance/back flows with mocked API client; pure modules (slot math, schedule
  normalization, draft storage) get table-driven edge cases (DST boundaries,
  overnight services, empty schedules, storage quota/corruption fallbacks).
- Deterministic under any clock/TZ: pinned system time for date/slot logic
  (reserve is exactly where calendar rot bit before — `plan-step-past-current-date`).
- Accurate tags (`@contract`, `@smoke` where fitting); tag ratchet green.
- Classification honesty identical to the hooks/components specs; the inventory
  ships in the implementation report.

## 4. Decisions Already Made

- Priority order: `features` (wizard steps, validation, api) → `shared`
  (lib/date/slot/storage utilities) → `pages` (smoke) → `app`/`entities`.
- One test file per source module/component, mirroring paths under
  `tests/reserve/`.
- Barrel files, pure-type files, and Storybook-only files are exempt (recorded).

## 5. Behavioral Requirements (EARS)

- THE inventory SHALL classify every currently-untested reserve source file with
  zero unclassified.
- THE logic-bearing reserve modules and wizard-step components SHALL meet the
  behavioral floor; presentational files the smoke floor.
- WHILE date/slot logic is tested, THE suites SHALL pin time and remain
  deterministic under any timezone.
- IF a reserve test exposes a real product defect, THEN THE implementer SHALL pin
  it as KNOWN-ISSUE and report it.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- All new suites pass under `pnpm test`; full suite green; tag guard green.
- The reported inventory covers 100% of reserve source files.
- All declared verification gates pass.

Tasks:

1. Enumerate + classify all reserve source files.
2. Features tree suites (wizard steps, validation, api client edges).
3. Shared utilities suites (dates, slots, storage).
4. Pages/app smoke suites.
5. Record gates via `governance:run-gates --spec MS-foundation-reserve-test-closure --record`;
   advance lifecycle.
