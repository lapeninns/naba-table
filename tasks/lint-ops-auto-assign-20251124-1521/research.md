---
task: lint-ops-auto-assign
timestamp_utc: 2025-11-24T15:21:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Clean up lint warning in ops auto-assign loop

## Requirements

- Functional: eliminate the ESLint warning (`@typescript-eslint/no-unused-vars`) in `scripts/ops-auto-assign-ultra-fast-loop.ts` so pre-commit passes with `--max-warnings=0` without altering runtime behavior.
- Non-functional: preserve current operational behavior of the script; no UI, DB, or Supabase changes; keep secrets out of source.

## Existing Patterns & Reuse

- Repo enforces zero warnings via `eslint --max-warnings=0` during pre-commit.
- Unused destructured variables in utility scripts have been removed elsewhere to satisfy the same rule; no special pattern required.

## External Resources

- None required; change is isolated to local script style.

## Constraints & Risks

- Minimal risk; must avoid unintended behavior changes in the ops cloning flow.
- Script may be used in production tooling—keep signature compatible for callers.

## Open Questions (owner, due)

- None; scope is fully defined.

## Recommended Direction (with rationale)

- Remove the unused `supabase` binding inside `cloneBooking` while keeping the parameter in the function signature (to avoid breaking callers) and rerun ESLint locally to confirm zero warnings.
