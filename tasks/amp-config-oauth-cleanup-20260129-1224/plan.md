---
task: amp-config-oauth-cleanup
timestamp_utc: 2026-01-29T12:24:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: AMP config + OAuth cleanup

## Objective

Remove the current OAuth-related remnants and align docs/routes with the actual Supabase auth flow; fix the "AMP config" once its intended meaning is confirmed.

## Success Criteria

- [ ] No OAuth-specific code/docs remain (as scoped below).
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] "AMP config" is either fixed (if located) or clarified as not present.

## Scope

- Remove unused `next-auth` type stub.
- Update docs that incorrectly label `/api/auth/callback` as OAuth.
- Remove the implicit hash handler (`ImplicitAuthHandler`) and its mount points.

## Out of Scope / Blockers

- "AMP config" changes are blocked until the intended meaning/location is identified.

## Testing Strategy

- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`

## Verification

- If any UI components/layouts are changed, do a quick manual sign-in page load check in browser (DevTools).
