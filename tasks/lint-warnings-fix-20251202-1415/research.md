---
task: lint-warnings-fix
timestamp_utc: 2025-12-02T14:15:09Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Resolve ESLint unused-variable warnings

## Requirements

- Functional: Remove or legitimately use variables flagged as unused so `eslint --max-warnings=0` passes.
- Non-functional: No behavior changes; maintain existing auth/onboarding flows; adhere to API route validation/auth patterns.

## Existing Patterns & Reuse

- API route handlers in `src/app/api/**` already use Zod for validation and Supabase helpers; pattern is to remove unused imports/variables when not needed.

## External Resources

- ESLint `@typescript-eslint/no-unused-vars` rule docs — clarifies that unused bindings should be removed or prefixed with `_` (no direct link needed).

## Constraints & Risks

- Avoid altering business logic of auth signup and onboarding zone creation.
- Pre-commit hook blocks merge if warnings remain.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Remove unused `defaultRedirectForHost`, `existingNames`, and `z` bindings to eliminate warnings while keeping current behavior unchanged.
