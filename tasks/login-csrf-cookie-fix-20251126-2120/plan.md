---
task: login-csrf-cookie-fix
timestamp_utc: 2025-11-26T21:20:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix login CSRF cookie error (Next.js 16)

## Objective

Ensure login pages render without 500 errors by moving CSRF cookie setting out of server components and relying on middleware-safe paths.

## Success Criteria

- [ ] `/auth/signin` and `/app/login` load without runtime errors
- [ ] `csrf_token` cookie still present on first load via middleware
- [ ] No regression to auth/session handling

## Architecture & Components

- Ops login page: should not set cookies directly
- Public auth login page: should not set cookies directly
- Middleware: single source for CSRF cookie creation

## Data Flow & API Contracts

- Middleware sets `csrf_token` cookie if missing on every request; server components read only.

## UI/UX States

- No UI changes expected; page should render normally.

## Edge Cases

- Requests that bypass middleware (none expected given matcher) — validate matcher covers routes.

## Testing Strategy

- Manual: start dev server, hit `/auth/signin` and `/app/login`, verify no errors and cookie present.
- Automated: rely on existing lint/type checks (no new tests needed for code removal).

## Rollout

- No flag required; small surface change.
- Monitoring: watch auth-related error logs for cookie issues.

## DB Change Plan (if applicable)

N/A
