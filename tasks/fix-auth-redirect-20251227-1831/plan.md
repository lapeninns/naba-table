---
task: fix-auth-redirect
timestamp_utc: 2025-12-27T18:32:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix auth redirect on app subdomain

## Objective

We will ensure users who log in on the app subdomain land on `/dashboard` (app area) so the proxy does not fall back to guest routes.

## Success Criteria

- [ ] Auth callback on app subdomain resolves to `/dashboard` (not `/guest/dashboard`).
- [ ] Redirect sanitization continues to reject unsafe or non-allowed paths.

## Architecture & Components

- `lib/auth/redirects.ts`: adjust host-based fallback redirect logic if needed.
- `src/app/api/auth/callback/route.ts`: verify fallback handling uses updated helper (no other changes).

## Data Flow & API Contracts

- Endpoint: GET `/api/auth/callback`
- Request: `redirectedFrom` query param (optional)
- Response: 3xx redirect
- Errors: Redirects to host-aware fallback if `redirectedFrom` invalid/absent.

## UI/UX States

- Not applicable (no UI change).

## Edge Cases

- app.localhost vs app.<rootDomain> hostnames.
- redirectedFrom is absolute URL on allowed host vs relative path.

## Testing Strategy

- Unit: add/adjust tests for `defaultRedirectForHost` and sanitize behavior (if tests exist).
- Integration: manual auth callback redirect check in dev.

## Rollout

- No feature flag.
- Verify on local dev and staging after merge.

## DB Change Plan (if applicable)

- Not applicable.
