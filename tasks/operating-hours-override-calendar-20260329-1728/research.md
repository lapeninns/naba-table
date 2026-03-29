---
task: operating-hours-override-calendar
timestamp_utc: 2026-03-29T17:28:38Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Operating Hours Override Calendar

## Requirements

- Functional:
  - Make the override date picker in restaurant settings use the same calendar interaction pattern as the rest of the product.
  - Keep existing override validation, editing, and save behavior unchanged.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain keyboard access and visible focus states.
  - Avoid introducing a custom primitive outside the shared Shadcn-based UI layer.
  - Keep the change scoped to the operating-hours settings surface.

## Existing Patterns & Reuse

- `src/components/features/restaurant-settings/OperatingHoursSection.tsx` currently renders override dates with a native `type="date"` input.
- `reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx` already uses the canonical shared pattern:
  - `@/components/ui/calendar`
  - `@/components/ui/popover`
  - trigger button with formatted label and error state
- `reserve/shared/ui/calendar.tsx` re-exports the shared `src/components/ui/calendar.tsx`, confirming there is already a single calendar primitive in the app.

## External Resources

- None needed; existing in-repo pattern is sufficient and preferred.

## Constraints & Risks

- `OperatingHoursSection.tsx` is already near the repo file-size cap, so the date control should be extracted or implemented compactly.
- The worktree contains unrelated local changes; this fix must avoid touching those files.
- The settings route is auth-gated, so verification should use the existing dev harness route when possible.

## Open Questions (owner, due)

- None. The requested change is clear from the existing shared pattern and current mismatch.

## Recommended Direction (with rationale)

- Replace the override row’s native date input with a small feature-local date picker built from the shared `Calendar`, `Popover`, and `Button` primitives.
- Keep the selected value stored as the same `YYYY-MM-DD` string so no API or validation behavior changes.
- Verify through the dev harness for restaurant settings and confirm the override picker matches the shared calendar interaction.
