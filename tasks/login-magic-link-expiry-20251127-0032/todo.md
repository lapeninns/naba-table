---
task: login-magic-link-expiry
timestamp_utc: 2025-11-27T00:32:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Inventory auth/magic-link code paths (frontend login page, API route/server action).
- [ ] Confirm environment variables for auth provider (Supabase/Email) in production.
- [ ] Verify CSRF cookie is set on login render (ops + guest), including on `app.localhost` scheme.

## Core

- [ ] Identify source of "Session expired" on `/app/login` and patch. _(Likely missing CSRF cookie/header.)_
- [ ] Fix magic link send failure (API handler, provider config, rate limits) by ensuring CSRF token is present.

## UI/UX

- [ ] Ensure loading, success, and error states on login form.
- [ ] Ensure redirect behavior works after login.

## Tests

- [ ] Add/update tests for magic link handler if feasible.
- [ ] Run existing auth/login test suite (pnpm test or relevant subset).

## Notes

- Assumptions: Production and app.localhost share code; email sending wired via configured provider.
- Deviations: None yet.

## Batched Questions

- Any recent deploy or config change around auth? (pending)
