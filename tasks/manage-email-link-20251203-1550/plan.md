---
task: manage-email-link
timestamp_utc: 2025-12-03T15:50:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix manage link in booking emails

## Objective

Use the public site domain for booking email manage links so recipients aren’t sent to localhost.

## Success Criteria

- Manage/CTA links in booking emails resolve to the configured site origin (e.g., production domain), never `localhost` unless intentionally set.
- No change to the booking path or token handling.

## Approach

- In `server/emails/bookings.ts`, derive a `bookingSiteUrl` that prefers `NEXT_PUBLIC_SITE_URL` or `SITE_URL`, falling back to the current `env.app.url`.
- Normalize the origin by trimming trailing slashes, then reuse it for manage links and CTAs.

## Testing Strategy

- Static review of generated URL logic.
- (Optional) Add or run a lightweight unit check if time permits; otherwise document manual verification gap.

## Rollout

- No feature flags or migrations required; change is safe to release once tests pass.
