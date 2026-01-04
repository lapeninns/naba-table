---
task: auth-verification-cleanup
timestamp_utc: 2026-01-04T18:05:00Z
owner: github:@opencode
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core logic

- [x] Inspect and update `components/auth/ImplicitAuthHandler.tsx` for `redirectedFrom` handling.
- [x] Validate that redirection only allows internal paths.

## Cleanup

- [x] Grep for `"/login"` and replace with `"/auth"` or appropriate hub links.
- [x] Grep for legacy SVG paths (e.g., old "Sajilo Reserve" paths) and replace with `BrandIcon`.

## Documentation

- [x] Verify/Update `docs/restaurant-facing-routes.md` — Already reflects Auth Hub flow.

## Verification

- [x] Manual E2E flow check (simulated via code inspection).
- [x] Verify `OpsShell` branding.

## Notes

- `ImplicitAuthHandler.tsx` already had `redirectedFrom` handling; added security validation.
- No legacy `/login` references found in codebase.
- No legacy "Sajilo Reserve" branding found in codebase (only in test file which was already updated).
- OpsShell correctly uses BrandLogo and redirects to `/auth/signin`.
- Pre-existing test failure found but is unrelated to this task.

## Batched Questions

- None.
