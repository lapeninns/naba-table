---
task: manage-email-link
timestamp_utc: 2025-12-03T15:50:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix manage link in booking emails

## Requirements

- Ensure the “Manage” link/button in guest booking emails points to the production guest site domain, not localhost.
- Keep existing booking management path (`/bookings/:id` with optional confirmation token) unchanged.
- No regressions to other email content or calendar attachments.

## Existing Patterns & Reuse

- `server/emails/bookings.ts` builds manage URLs using `siteUrl = env.app.url` (prefers `NEXT_PUBLIC_APP_URL`).
- Environment helper `env` exposes `NEXT_PUBLIC_SITE_URL` and `SITE_URL`; `getCanonicalSiteUrl` falls back to configured domain.
- Email rendering uses shared helpers in `server/emails/base` and `libs/resend`—no change needed.

## Constraints & Risks

- Changing the base URL must not break links when only APP_URL is provided (fallback required).
- Avoid introducing double slashes in URLs; keep string concatenation safe.
- Keep scope limited to booking email links (no broader env refactors).

## Open Questions

- None at this time; assuming guest-facing manage link should prefer public site domain.

## Recommended Direction (with rationale)

- Build booking email links from `NEXT_PUBLIC_SITE_URL` (or `SITE_URL`) first, falling back to existing `env.app.url`. This avoids localhost defaults when APP_URL is left as dev value in production.
- Trim trailing slashes on the chosen origin to prevent `//bookings` issues.
