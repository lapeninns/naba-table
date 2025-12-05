---
task: lint-guest-view-models-any
timestamp_utc: 2025-12-05T15:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix ESLint `no-explicit-any` in guest view-model test

## Requirements

- Functional: remove the two `@typescript-eslint/no-explicit-any` warnings in `tests/server/guest/view-models.test.ts` so lint passes with `--max-warnings=0`.
- Non-functional: keep existing test behavior; no scope creep beyond lint fixes.

## Existing Patterns & Reuse

- Guest services rely on `GuestServerServices` which expects `supabasePromise: Promise<SupabaseClient<Database>>` and `AuthPort` returning Supabase `User` objects.
- Similar tests stub Supabase clients via typed placeholders rather than `any`.

## External Resources

- Supabase JS `User` type (for constructing a typed fake user).

## Constraints & Risks

- Engine in `package.json` targets Node 20.11.1; current runtime is Node 22.12.0 (warning-only, but note for reproducibility).
- Lint previously terminated with SIGKILL when run over many files; plan to run a narrow, single-file lint to avoid OOM.

## Open Questions (owner, due)

- None for this scoped lint fix.

## Recommended Direction (with rationale)

- Replace `any` casts with properly typed test doubles: construct a minimal `User` object and a typed `SupabaseClient<Database>` placeholder. Keeps type safety while avoiding broad refactors.
