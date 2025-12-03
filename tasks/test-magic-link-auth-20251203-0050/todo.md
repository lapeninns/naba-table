---
task: test-magic-link-auth
timestamp_utc: 2025-12-03T00:50:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm `.env.local` contains required auth vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com`, `NEXT_PUBLIC_APP_URL`.
- [x] Choose controlled test email (prefer `NEXT_PUBLIC_SUPPORT_EMAIL`); note selection. (Using `info@lapeninns.com` from env.)

## Core Tests

- [x] Run `pnpm test src/app/api/auth/signin/route.test.ts src/app/api/auth/signup/route.test.ts`.
- [x] Run `node test-magic-link.mjs <test-email>` and save output to `artifacts/magic-link-send.log`.
- [ ] (If inbox access) Follow received magic link, ensure redirect to dashboard and cookies scoped to `.nabatable.com`; capture screenshot/notes.

## Wrap-up

- [x] Summarize results, limitations, and any follow-ups in `verification.md`.
- [x] Attach artifacts (logs/screens) in `tasks/test-magic-link-auth-20251203-0050/artifacts/`.

## Notes

- Assumptions: testing uses a pre-existing account email to avoid signup-disabled errors; no code changes expected.
- Deviations: document if inbox access is unavailable and testing stops at send verification.
