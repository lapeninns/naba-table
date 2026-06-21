---
task: old-school-house-override-notes
timestamp_utc: 2026-04-17T16:52:21Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Old School House Override Notes

## Requirements

- Functional:
  - Update The Old School House operating-hours notes so the weekly schedule has empty notes.
  - Add temporary date overrides with the note `Open for drinks only for now. Food service is paused while the kitchen offer gets ready.`
  - Keep the opening hours themselves unchanged.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Use the remote production Supabase path only.
  - Preserve the canonical operating-hours row shape and validation rules.
  - Record before/after evidence for the production data change.

## Existing Patterns & Reuse

- The canonical operating-hours read/write implementation lives in `server/restaurants/operatingHours.ts`.
- `updateOperatingHours()` replaces the restaurant’s full weekly and override set in one write path, so the safest update is to read the current rows, modify only the notes and target override dates, then write the full payload back through the same schema.

## External Resources

- None. This task uses the repo’s existing production Supabase environment and data model.

## Constraints & Risks

- This is a production data change affecting the guest-facing operating-hours note.
- The user’s requested date window is ambiguous:
  - `7 days` suggests `2026-04-18` through `2026-04-24` inclusive.
  - `until next Friday` from Friday `2026-04-17` could also mean `2026-04-17` through `2026-04-24` inclusive.
- The current production state already has the note on all weekly rows and no overrides, so a mistaken date window would immediately change the live guest-facing message coverage.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- After the date range is confirmed, read the full current Old School House snapshot, clear weekly notes to `null`, create per-date overrides for the confirmed dates using the same opens/closes values as the corresponding weekly day, set the note on those overrides only, then capture the before/after snapshot in task artifacts.
