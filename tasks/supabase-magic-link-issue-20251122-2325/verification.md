---
task: supabase-magic-link-issue
timestamp_utc: 2025-11-22T23:45:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors during sign-in flow.
- [ ] Network requests to `/api/auth/callback` return 307 Redirect.
- [ ] `/api/v1/events` returns 204 (no 404s).

### DOM & Accessibility

- [ ] SignInForm is accessible.

## Test Outcomes

- [ ] Magic link email received.
- [ ] Clicking link redirects to `/app` (or requested path).
- [ ] Session is established (user logged in).

## Artifacts

- None.

## Known Issues

- Supabase redirect URL allowlist must be configured in the dashboard to include `http://localhost:3000/**`.

## Sign‑off

- [ ] Engineering
