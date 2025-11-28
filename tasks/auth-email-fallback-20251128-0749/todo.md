---
task: auth-email-fallback
timestamp_utc: 2025-11-28T07:49:53Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm Supabase auth setting for email confirmations in target env (staging/production) to understand expected behavior.

## Core

- [ ] Update `src/app/api/auth/signin/route.ts` magic-link call to `shouldCreateUser: false` and adjust error mapping for missing users.
- [ ] Keep rate-limit headers intact after change.

## Tests

- [ ] Update/extend `src/app/api/auth/signin/route.test.ts` to assert Supabase call options and response for unknown user.
- [ ] (Optional) Adjust SignIn form test if error copy changes.

## Verification

- [ ] Manual QA in staging: request magic link with existing user (email received once); request with new email (no email sent, friendly error).
- [ ] Document evidence in `verification.md` (logs/screens).

## Notes

- Assumption: production signups remain invite-only; unknown emails should not create accounts.
