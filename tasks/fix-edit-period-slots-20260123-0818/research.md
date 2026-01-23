---
task: fix-edit-period-slots
timestamp_utc: 2026-01-23T08:18:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Prevent Out-of-Period Edit Slots

## Requirements

- Functional:
  - Dashboard edit flow must not reintroduce out-of-period time slots as selectable.
  - Schedule-derived availability should remain the single source of truth for selectable times.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing accessibility behavior of the time picker.
  - No additional network requests or perf regressions.

## Existing Patterns & Reuse

- `ScheduleAwareTimestampPicker.mergeWithSyntheticSlots` synthesizes missing slots for edit flows.
- Availability filtering for suggestions uses `availableSlots` with `slot.disabled`, target-service checks, and `hasCapacity`.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases; no coding before plan is documented.
- UI change requires Chrome DevTools MCP manual QA with artifacts.
- Risk: removing synthetic slot availability might hide legacy booking times that are out-of-period.

## Open Questions (owner, due)

- Should edits allow preserving legacy out-of-period times, or must those be blocked entirely? (owner: github:@maintainers, due: 2026-01-23)
  - Answer: No legacy out-of-period bookings exist; block out-of-period times in edit flow.
- Keep or remove the `buildAvailability` fallback if it is now redundant? (owner: github:@maintainers, due: 2026-01-23)
  - Answer: Remove the fallback.

## Recommended Direction (with rationale)

- Prevent synthetic slots from being treated as available by default, so only real service-period slots are selectable.
- Add `endMinutes > startMinutes` validation to `buildCoverage` for consistency with `periodDetails`.
- Remove `buildAvailability` fallback per maintainer decision.
