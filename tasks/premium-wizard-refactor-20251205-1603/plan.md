# Implementation Plan: Premium Guest Experience Refactor

---

task: premium-wizard-refactor  
timestamp_utc: 2025-12-05T16:03:37Z
owner: github:@amanshresthaa
reviewers: []
risk: medium

---

## Objective

We will refactor the booking wizard UI components to deliver a **Premium Guest Experience** so that guests feel the booking process is polished, accessible, and luxurious.

## Success Criteria

- [ ] WizardNavigation has glass effect, floating capsule on desktop, stacked on mobile
- [ ] WizardStep has enhanced shadows, elegant progress line, refined typography
- [ ] PlanStep uses bento grid layout (3 cols desktop, 2 cols tablet, 1 col mobile)
- [ ] DetailsStep has two cards (Contact, Preferences) with shake animation for Terms
- [ ] ReviewStep has ticket metaphor with dashed separator and Edit buttons
- [ ] ConfirmationStep has celebration animation and elegant auto-redirect countdown
- [ ] All validation errors in `aria-live="polite"` regions
- [ ] Keyboard navigation works end-to-end
- [ ] TypeScript strict mode passes (no `any`)

## Architecture & Components

### New Files

1. `reserve/features/reservations/wizard/utils/groupActions.ts` - Extracted action grouping utility
2. `reserve/features/reservations/wizard/ui/types.ts` - Shared UI types

### Modified Files (in order)

1. `WizardNavigation.tsx` - Glass effect, floating capsule, motion
2. `WizardStep.tsx` - Enhanced container styling
3. `PlanStep.tsx` - Minimal structure changes
4. `plan-step/PlanStepForm.tsx` - Bento grid, time slot presentation
5. `DetailsStep.tsx` - Two-card layout, shake animation
6. `ReviewStep.tsx` - Ticket metaphor, edit buttons
7. `ConfirmationStep.tsx` - Celebration, countdown refinement

## Data Flow & API Contracts

No API changes. All changes are UI-only.

## UI/UX States

### WizardNavigation

- Default: Glass effect sticky footer
- Mobile: Full-width, stacked layout
- Desktop: Floating capsule, inline layout
- Entry animation: Slide-in-from-bottom

### Steps

- Loading: Skeleton states (existing)
- Error: Alert with icon in aria-live region
- Success: Smooth transitions between steps

## Edge Cases

1. Terms not checked → shake animation + focus on error
2. No date selected → Time section shows empty state message
3. Auto-redirect cancelled → Alert message, manual close option

## Testing Strategy

- Manual QA via Chrome DevTools (MCP)
- Keyboard navigation testing
- Screen reader compatibility (ARIA assertions)
- Responsive layout verification

## Rollout

- Direct merge after review (no feature flag needed for UI polish)
- All changes are backwards compatible
