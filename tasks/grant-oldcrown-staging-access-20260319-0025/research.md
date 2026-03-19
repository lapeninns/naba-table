---
task: grant-oldcrown-staging-access
timestamp_utc: 2026-03-19T00:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Grant Old Crown staging access

## Requirements

- Functional:
  - Grant `oldcrown@lapeninns.com` access to Old Crown in staging.
  - Use the canonical repo path for membership changes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Remote-only Supabase access.
  - Do not expose secrets in artifacts.

## Existing Patterns & Reuse

- `scripts/grant-restaurant-access.ts` is the canonical service-role script for adding/updating `restaurant_memberships`.
- Prior task evidence identifies Old Crown Girton slug as `the-old-crown-girton`.
- Repo linked staging project is `ndxmivcrehsacuerwxtm`.

## Constraints & Risks

- The grant script requires `CONFIRM_PRODUCTION=true` for any write, even for staging.
- We should avoid broad role changes unless necessary; default requested role will be used.

## Recommended Direction (with rationale)

- Use `scripts/grant-restaurant-access.ts` with `EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm`, `RESTAURANT_SLUG=the-old-crown-girton`, `USER_EMAIL=oldcrown@lapeninns.com`, and `ROLE=owner`.
