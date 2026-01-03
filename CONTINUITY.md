# Continuity Ledger

Last updated: 2026-01-03T03:45:00Z

## Goal (incl. success criteria)

- **NEW**: Revamp BookingDialog to use only Shadcn UI primitives (Card, Badge, Button, etc.) for better consistency and maintainability.
- Success: All custom components replaced with Shadcn compositions, no functionality regressions, all tests pass, perf/a11y budgets met.

## Constraints/Assumptions

- Follow AGENTS SDLC: create task folder, research.md, plan.md, todo.md, verification.md.
- Manual UI QA via Chrome DevTools MCP is required for UI changes (attach artifacts).
- Use Shadcn UI primitives for UI work; avoid custom primitives.
- No API or backend changes for this refactor.
- Preserve all existing functionality (booking lifecycle, table assignment, shortcuts).

## Key decisions

- **Incremental refactor**: Replace custom components one at a time (BookingStatusBadge, ClickToCopy, BookingStatCard, etc.)
- **Preserve logic**: Keep hooks, mutations, validations, shortcuts intact; only change UI layer.
- **Shadcn Card compositions**: Use Card + CardHeader + CardContent for all panel sections.
- **Semantic variants**: Replace hardcoded colors with Shadcn variants (primary, destructive, default, outline).

## State

- ✅ Task folder created: `tasks/booking-dialog-shadcn-revamp-20260103-0345/`
- ✅ Research.md, plan.md, todo.md, verification.md initialized.

## Done

- Created task folder and SDLC artifacts (research, plan, todo, verification).
- Analyzed current BookingDialog structure and identified custom components to replace.
- Documented Shadcn primitives available and replacement strategy.

## Now

- Ready to begin Phase 1: Replace simple custom components (BookingStatusBadge, ClickToCopy, ContactInfoRow).

## Next

- Phase 2: Refactor Card-based components (BookingStatCard, GuestProfilePanel, DialogHeader).
- Phase 3: Simplify layout & colors (replace hardcoded classes with Shadcn variants).
- Phase 4: Footer actions cleanup.
- Phase 5: Testing & validation (unit, integration, E2E, a11y).
- Phase 6: Manual QA via Chrome DevTools MCP and capture artifacts.

## Open questions (UNCONFIRMED if needed)

- Should we add Storybook stories for refactored components? (UNCONFIRMED)
- Do we need to update design system documentation? (UNCONFIRMED)
- Should we use Tabs instead of 2-column grid for mobile? (UNCONFIRMED - current grid works well)

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/booking-details/BookingDialog.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/booking-details/components/\*.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/booking-dialog-shadcn-revamp-20260103-0345/
