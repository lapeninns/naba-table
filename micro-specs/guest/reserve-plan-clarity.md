---
spec_id: MS-guest-reserve-plan-clarity
status: verified
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/guest/**
  - reserve/index.html
  - reserve/features/reservations/wizard/hooks/usePlanStepForm.ts
  - reserve/features/reservations/wizard/ui/steps/plan-step/**
  - tests/reserve/**
implementation_surfaces:
  - micro-specs/guest/reserve-plan-clarity.md
  - reserve/index.html
  - reserve/features/reservations/wizard/hooks/usePlanStepForm.ts
  - reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - tasks/customer-booking-wizard-audit-20260712-1004/plan.md
related_tests:
  - tests/reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.test.tsx
  - tests/reserve/plan-step-past-current-date.test.tsx
  - tests/reserve/plan-step-date-candidate.test.ts
  - tests/reserve/standalone-boundaries.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test --maxWorkers=8
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm reserve:build
  - pnpm guard:no-shadcn:strict
  - pnpm guard:luma:strict
  - pnpm qa:reserve-app:browser
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - 'evidence-waiver: verified on the intentionally uncommitted audit task tree; no commit was requested (expires: 2026-07-19)'
---

# MS-guest-reserve-plan-clarity — Reserve plan clarity and date disclosure

## 1. Exact Goal and User-Visible Outcomes

Guests can identify required Plan fields, understand why Continue is unavailable, zoom the
standalone Reserve page, and are explicitly told whenever availability moves them to a later date.

## 2. Blast Radius

Only the standalone viewport contract, Plan form/date-selection behavior, and their tests may be
edited. Shared primitives, booking availability rules, ops behavior, and database code are out of
scope.

## 3. Strict Constraints and Assumptions

- Preserve the existing schedule source and 60-day candidate search.
- Never describe a date change that did not occur.
- Keep all date announcements locale-readable and PII-free.
- Use existing Luma primitives and Reserve-scoped styling.

## 4. Decisions Already Made

Required state is communicated in visible copy and accessible attributes. Browser zoom is not
disabled. A one-day or multi-day automatic date move is allowed only with a polite announcement
that names the selected date.

## 5. Behavioral Requirements (EARS)

- THE Plan step SHALL visibly identify party, date, and time as required.
- WHILE Continue is disabled, THE Plan step SHALL expose a concise missing-selection reason.
- THE standalone Reserve viewport SHALL permit user scaling.
- WHEN a closed date is automatically replaced, THE Plan step SHALL politely announce the new
  date.
- WHEN the current day's slots have elapsed and a later date is automatically selected, THE Plan
  step SHALL politely announce the new date.

## 6. Verification Criteria and Task Breakdown

Tests must prove required/disabled guidance, the scalable viewport, one-day and multi-day date
announcements, and unchanged manual date selection. Implement each behavior red to green, verify
the shipped mobile route, then record all gates and advance the lifecycle.
