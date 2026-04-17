---
task: operating-hours-advisory-notes
timestamp_utc: 2026-04-17T16:44:42Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Operating Hours Advisory Notes

## Requirements

- Functional:
  - Replace the generic reservation-plan advisory copy with the selected date's operating-hours note when one is available.
  - Keep the existing weekend/date-override advisory as the fallback when no operating-hours note exists for the selected date.
  - Source the advisory from the canonical reservation schedule path used by the reserve booking wizard.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve the existing alert semantics and `aria-live` behavior.
  - Keep the change scoped to the reserve booking wizard.
  - Avoid introducing duplicate schedule or operating-hours fetch paths.

## Existing Patterns & Reuse

- The info alert is rendered by `reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx`.
- The advisory text is currently derived in `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts` via `derivePlanDateAdvisory`.
- The backend schedule source already resolves the effective weekly or override operating-hours row in `server/restaurants/schedule.ts`.
- Operating-hours rows already store `notes`, but that field is not currently included in the schedule API payload consumed by the reserve wizard.

## External Resources

- None. The change stays within existing repo contracts and patterns.

## Constraints & Risks

- This is a UI behavior change, so Chrome DevTools verification is required by repo policy.
- The advisory should not disappear for weekend/override dates that have no operating-hours note.
- The effective note must follow the same precedence as the effective schedule row: date override first, then weekly fallback.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Extend the canonical restaurant schedule response to include the effective operating-hours `notes`, normalize it in the reserve schedule client, and update `derivePlanDateAdvisory` to prefer that note before falling back to the current generic advisory logic.
