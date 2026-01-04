---
task: brand-auth-final-cleanup
timestamp_utc: 2026-01-04T16:00:00Z
owner: github:@opencode
---

# Implementation Plan: Final Brand and Auth Cleanup

## Objective

Standardize all brand representations and ensure all auth entry points lead to the unified `/auth` route.

## Success Criteria

- [ ] `config.auth.loginUrl` is `/auth`.
- [ ] No JSX/TSX files contain `href="/login"`.
- [ ] All major navbars/footers use `<BrandLogo />`.
- [ ] No hardcoded SVGs of the "Nab a Table" logo remain.

## Architecture & Components

- `BrandLogo` (reuse)
- `config.ts` (update)

## Data Flow & API Contracts

- N/A

## UI/UX States

- Consistent logo across all pages.
- "Sign In" always goes to role selection/dashboard.

## Edge Cases

- Links in markdown documentation (e.g., `README.md`).
- Links in tests.

## Testing Strategy

- Manual verification of "Sign In" buttons.
- Grep for deprecated strings.

## Rollout

- Direct update to codebase.
