---
spec_id: MS-guest-reserve-review-navigation
status: verified
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/guest/**
  - components/reserve/booking-flow/use-sticky-progress.ts
  - reserve/main.tsx
  - reserve/system-theme.ts
  - reserve/features/reservations/wizard/hooks/useReviewStep.ts
  - reserve/features/reservations/wizard/ui/**
  - reserve/features/reservations/wizard/ui/steps/plan-step/components/**
  - tests/reserve/**
implementation_surfaces:
  - micro-specs/guest/reserve-review-navigation.md
  - reserve/main.tsx
  - reserve/system-theme.ts
  - reserve/features/reservations/wizard/hooks/useReviewStep.ts
  - reserve/features/reservations/wizard/ui/WizardContainer.tsx
  - reserve/features/reservations/wizard/ui/WizardProgress.tsx
  - reserve/features/reservations/wizard/ui/WizardStep.tsx
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - tasks/customer-booking-wizard-audit-20260712-1004/plan.md
related_tests:
  - tests/reserve/features/reservations/wizard/hooks/useReviewStep.test.tsx
  - tests/reserve/features/reservations/wizard/ui/BookingWizard.test.tsx
  - tests/reserve/features/reservations/wizard/ui/WizardContainer.test.tsx
  - tests/reserve/features/reservations/wizard/ui/WizardProgress.test.tsx
  - tests/reserve/features/reservations/wizard/ui/WizardStep.test.tsx
  - tests/reserve/system-theme.test.ts
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

# MS-guest-reserve-review-navigation — Reserve review and navigation accessibility

## 1. Exact Goal and User-Visible Outcomes

Guests see an unambiguous Review summary, can return through completed pre-confirmation progress
steps, receive one step announcement and a visible active-step focus cue, and get system dark mode
in standalone Reserve without carrying unused wizard components. Confirmation is terminal so a
submitted booking cannot be reopened through progress navigation.

## 2. Blast Radius

Edits are limited to Review summary composition, wizard progress/container/step behavior,
standalone theme initialization, action-bar availability, verified dead wizard components, and
tests.
Forward navigation, booking behavior, shared primitives, and ops contracts are out of scope.

## 3. Strict Constraints and Assumptions

- Before confirmation, only completed steps are navigable; current and future steps remain inert.
- After confirmation, every progress marker remains inert.
- Exactly one polite step-change announcement remains.
- Programmatic focus has a visible cue independent of `:focus-visible`.
- System dark-mode handling must react to preference changes and preserve the guest theme.
- Delete only components with no shipped production consumer.
- The occasion-selection Storybook surface is an explicitly design-only fixture; it does not imply
  that the deleted production OccasionPicker remains shipped.

## 4. Decisions Already Made

Review Date & Time contains date and time only; party size stays in its separate row. Progress
supports backward navigation only before successful submission. Confirmation is terminal. The sole
action bar remains available throughout the step and its unused visibility observer is removed.
The false alarms for 24-hour consistency and date popover semantics require no edits.

## 5. Behavioral Requirements (EARS)

- THE Review Date & Time value SHALL exclude party size.
- BEFORE confirmation, WHEN a guest activates a completed progress step, THE wizard SHALL navigate
  backward to it.
- AFTER the booking reaches Confirmation, THE progress steps SHALL remain non-interactive.
- THE current and future progress steps SHALL remain non-interactive.
- WHEN the active step changes, THE wizard SHALL expose exactly one polite announcement.
- WHILE a step is active, THE focused step card SHALL have a visible active cue.
- WHEN system dark preference is active or changes, THE standalone Reserve root SHALL synchronize
  its `dark` class.
- THE wizard action bar SHALL remain available throughout each step without an unused visibility
  observer.
- THE shipped wizard bundle SHALL NOT retain the verified unconsumed StepSummary,
  ConfirmationStepSkeleton, OccasionPicker, or TimeSlotGrid production modules.
- THE governed Storybook set SHALL retain a truthfully named occasion-selection design fixture,
  PlanStepForm, and Calendar24Field review surfaces.

## 6. Verification Criteria and Task Breakdown

Tests must prove summary composition, completed-only pre-confirmation navigation, terminal
confirmation progress, one live region, active visual focus, reactive system dark mode, persistent
actions, and absence of dead shipped exports/files while retaining governed Storybook surfaces.
Implement red to green, verify the shipped route at mobile and desktop widths in light and dark,
then record all gates and advance the lifecycle.
