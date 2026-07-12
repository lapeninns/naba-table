---
spec_id: MS-guest-reserve-wizard-audit
status: superseded
risk_class: customer-pii
owner: amankumarshrestha
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/guest/**
  - CONTINUITY.md
  - package.json
  - reserve/.storybook/**
  - reserve/index.html
  - reserve/main.tsx
  - reserve/system-theme.ts
  - reserve/features/reservations/wizard/hooks/**
  - reserve/features/reservations/wizard/model/**
  - reserve/features/reservations/wizard/ui/**
  - reserve/shared/hooks/useStickyProgress.ts
  - components/reserve/booking-flow/use-sticky-progress.ts
  - server/bookings/create-completion.ts
  - server/bookings/create-failure-response.ts
  - server/bookings/request-validation.ts
  - tests/e2e/guest-reserve-routes.spec.ts
  - tests/reserve/**
  - tests/server/booking-create-completion.test.ts
  - tests/server/booking-create-failure-response.test.ts
  - tests/server/booking-create-payloads.test.ts
  - tests/server/booking-create-request-payload.test.ts
  - tests/server/booking-request-validation.test.ts
implementation_surfaces:
  - micro-specs/guest/reserve-wizard-audit.md
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - tasks/customer-booking-wizard-audit-20260712-1004/plan.md
related_tests:
  - tests/e2e/guest-reserve-routes.spec.ts
  - tests/reserve/detailsFormSchema.test.ts
  - tests/reserve/plan-step-date-candidate.test.ts
  - tests/reserve/features/reservations/wizard/ui/WizardProgress.test.tsx
  - tests/server/booking-request-validation.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test --maxWorkers=8
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm reserve:build
  - pnpm storybook:build
  - pnpm guard:no-shadcn:strict
  - pnpm guard:luma:strict
  - pnpm qa:reserve-app:browser
  - pnpm qa:observability-privacy
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - 'evidence-waiver: parent audit coordination record is amended into the authorized local commit after child lifecycle transitions (expires: 2026-07-19)'
---

# MS-guest-reserve-wizard-audit — Reserve wizard audit coordination

## 1. Exact Goal and User-Visible Outcomes

Coordinate the already-approved Reserve wizard audit across the standalone, contact/consent,
Plan clarity, and Review/navigation child Micro-Specs so their branch-level lifecycle evidence can
be recorded without misattributing one child slice to another. This parent adds no new user-visible
behavior beyond those four child specs.

## 2. Blast Radius

The radius is the explicit union of the four child Micro-Specs and the task ledger. It exists only
for branch-diff attribution while the independently scoped child specs advance. No additional
production file, shared primitive, database contract, or provider integration is authorized.

## 3. Strict Constraints and Assumptions

- The four child specs remain authoritative for their individual EARS requirements and tests.
- This parent must not be used to justify new implementation work.
- All verification remains local, mocked, and fail-closed; no database or provider mutation runs.
- Once every child is verified, this coordination record is superseded rather than implemented.

## 4. Decisions Already Made

D1 remains customer email OR phone, D2 remains Details-scoped 44px controls, and D3 remains fresh
unchecked consent. Batch 0, contact/consent, Plan clarity, and Review/navigation remain separate
reviewable slices.

## 5. Behavioral Requirements (EARS)

- WHILE the four child Micro-Specs transition on one branch, THE governance lifecycle SHALL be able
  to attribute every changed audit file to this parent or its authoritative child.
- THE parent coordination record SHALL NOT introduce behavior beyond the child requirements.
- WHEN all four child Micro-Specs are verified, THE parent SHALL be superseded with a reason naming
  the completed split.

## 6. Verification Criteria and Task Breakdown

Verify that governance accepts the combined branch diff, advance each child with fresh declared
gates and evidence, then supersede this parent. The final task ledger must name the four verified
children, browser evidence, independent review verdicts, and any explicitly deferred adjacent
boundary.
