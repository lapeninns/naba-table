---
task: fix-lint-scripts
timestamp_utc: 2025-12-28T12:07:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix lint failures in scripts

## Requirements

- Functional:
  - Lint-staged must pass for `scripts/**/*.{js,ts,tsx,jsx}` without `@typescript-eslint/no-require-imports` errors.
  - Remove hard-coded secrets from scripts; use env vars instead.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: no secrets committed in source.

## Existing Patterns & Reuse

- Scripts already use ESM + dotenv pattern in `scripts/check-staging-supabase.ts` and `scripts/validate-env.ts`.
- Env schema includes `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## External Resources

- None.

## Constraints & Risks

- Root AGENTS policy: no secrets in source; SDLC artifacts required.
- Scripts are not referenced elsewhere, so renaming to `.ts` should be safe.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Convert the three scripts to TypeScript with ESM imports, load `.env.local`, and read required credentials from env vars. This aligns with existing script patterns and resolves lint errors.
