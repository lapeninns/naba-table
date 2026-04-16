---
task: update-manager-notification-phones
timestamp_utc: 2026-04-15T16:54:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Update Manager Notification Phones

## Requirements

- Functional:
  - Update the production `manager_notification_phone` for:
    - `the-railway-pub`
    - `white-horse-pub-waterbeach`
    - `the-old-crown-girton`
    - `the-corner-house-pub-cambridge`
  - Keep `manager_daily_summary_enabled` intact.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No secrets in task artifacts.
  - Use the production remote Supabase path only.
  - Preserve canonical phone formatting expected by the ops API (`E.164`).

## Existing Patterns & Reuse

- Restaurant manager numbers are stored on `restaurants.manager_notification_phone`.
- The canonical validation path requires `managerNotificationPhone` in `E.164` format via `src/app/api/ops/restaurants/schema.ts`.
- Server updates trim and persist the value through `server/restaurants/update.ts`.

## External Resources

- None. This task uses the repo's production Supabase environment and existing validation rules.

## Constraints & Risks

- This is a production data change affecting manager SMS routing.
- User-provided values were not all in `E.164`, so normalization is required before writing.
- The Corner House input was supplied as `7476415818`; the repo's UK phone parsing accepts this as a valid GB mobile and normalizes it to `+447476415818`.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Read the current production restaurant rows, normalize the requested numbers to `E.164`, apply a scoped update to only `manager_notification_phone`, then re-read the same rows for verification.
