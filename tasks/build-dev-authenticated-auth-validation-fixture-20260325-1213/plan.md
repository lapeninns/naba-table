---
task: build-dev-authenticated-auth-validation-fixture
timestamp_utc: 2026-03-25T12:13:04Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: build-dev-authenticated-auth-validation-fixture

## Objective

We will add a dev-only authenticated auth-validation harness so validators can prove signed-in guest and owner redirect behavior without mutating shared local auth state.

## Success Criteria

- [ ] A dev-only harness exposes deterministic guest and owner/authenticated redirect outcomes for `/`, `/auth`, and `/auth/signin` intent flows.
- [ ] Playwright coverage proves authenticated guest home redirect, sign-in return-to-intent, and authenticated `/auth` canonicalization.
- [ ] The harness is documented for future user-testing workers.

## Architecture & Components

- `src/app/(public)/dev/auth-validation/page.tsx`: server-only dev harness entrypoint guarded by `enforceDevOnly()`.
- Shared helper module for fixture redirect computation that reuses existing redirect sanitization/host-aware defaults.
- `tests/e2e/guest-auth-pages.spec.ts`: add harness-driven assertions.
- `.factory/library/user-testing.md`: record the exact harness URL patterns validators should use.

## Data Flow & API Contracts

- Harness query inputs:
  - `scenario`: `home` | `auth` | `signin`
  - `role`: `guest` | `owner` | `admin`
  - `redirectedFrom`: optional candidate path
- Harness output:
  - rendered fixture summary with final canonical target and explanatory labels
  - optional client redirect via `redirect()` where browser-level final URL must be proven

## UI/UX States

- Success fixture state with visible role, scenario, sanitized input, and final destination.
- Invalid query fallback to default guest scenario.

## Edge Cases

- Unsafe `redirectedFrom` values must sanitize away.
- Owner/admin intent on the guest host should canonicalize to app-host sign-in or `/app` as appropriate.
- Guest intent should stay on guest-owned routes.

## Testing Strategy

- RED/GREEN Playwright updates for the auth harness flows.
- Full required validation: feature Playwright, `pnpm typecheck`, `pnpm lint`.
- Manual browser verification through the dev harness.

## Rollout

- No feature flag; dev-only harness guarded by `enforceDevOnly()` and non-production environment checks.
