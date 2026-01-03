# Implementation Checklist

## Setup

- [x] Create task folder `booking-dialog-shadcn-revamp-20260103-0345/`
- [x] Create research.md with requirements and analysis
- [x] Create plan.md with architecture and success criteria
- [ ] Audit current component tree and identify replacement targets

## Phase 1: Replace Simple Custom Components

- [ ] Replace `BookingStatusBadge` with Shadcn `Badge`
- [ ] Replace `ClickToCopy` with Shadcn `Button` + copy logic
- [ ] Replace `ContactInfoRow` with div + Shadcn typography
- [ ] Run lint and typecheck after each replacement

## Phase 2: Refactor Card-based Components

- [ ] Replace `BookingStatCard` with Shadcn `Card` composition
- [ ] Refactor `GuestProfilePanel` to use Shadcn Card sections internally
- [ ] Refactor `DialogHeader` to use Shadcn Card with accent border
- [ ] Refactor `TableAssignmentPanel` wrapper to use Shadcn Card

## Phase 3: Simplify Layout & Colors

- [ ] Replace hardcoded color classes with Shadcn semantic variants
- [ ] Ensure consistent spacing using Shadcn design tokens
- [ ] Verify responsive layout (mobile Sheet, desktop Dialog)
- [ ] Verify header tone colors use Shadcn border utilities

## Phase 4: Footer Actions Cleanup

- [ ] Simplify footer button logic using Shadcn Button variants
- [ ] Ensure primary action uses semantic variant (default/destructive)
- [ ] Verify button group layout and spacing

## Phase 5: Testing & Validation

- [ ] Run unit tests for refactored components
- [ ] Run integration tests for booking dialog flow
- [ ] Run E2E tests (Playwright) for booking lifecycle
- [ ] Run axe a11y checks (0 critical/serious issues)
- [ ] Manual keyboard navigation test
- [ ] Manual QA via Chrome DevTools MCP (required)

## Phase 6: Verification & Artifacts

- [ ] Capture Lighthouse report (perf/a11y budgets)
- [ ] Capture screenshots (before/after comparison)
- [ ] Document findings in verification.md
- [ ] Attach artifacts to `artifacts/` folder

## Notes

### Assumptions

- Shadcn primitives (Dialog, Card, Badge, Button) are already installed and configured
- No API or backend changes required
- Existing tests cover the booking dialog flows

### Deviations

- None yet

## Batched Questions

- Should we add storybook stories for the refactored components?
- Do we need to update design system documentation?
