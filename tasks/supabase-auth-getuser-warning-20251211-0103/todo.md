---
task: supabase-auth-getuser-warning
timestamp_utc: 2025-12-11T01:03:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Replace `getSession()` with `getUser()` in `src/app/layout.tsx` where only user is needed.
- [x] Update `src/app/api/auth/callback/route.ts` to prefer `getUser()` for user identity.
- [x] Review `src/components/auth/SignInForm.tsx` for safe usage (kept and switched to `getUser()`).

## Verification

- [x] Run `pnpm run build` to confirm warning gone and types pass.
- [ ] Manual request to `/` ensuring no Supabase warning logs.

## Notes

- No UI changes; auth only.
