---
task: lint-get-reservation
timestamp_utc: 2025-11-24T15:34:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix ESLint any in getReservation

## Requirements

- Functional: Resolve `@typescript-eslint/no-explicit-any` warning in `server/reservations/getReservation.ts` (line ~26) so pre-commit `eslint --max-warnings=0` passes.
- Non-functional: Keep runtime behavior unchanged; no DB or API contract changes.

## Existing Patterns & Reuse

- Other Supabase client types in repo typically use `SupabaseClient<Database>` or the schema-specific generic instead of `any`.
- The function already receives `supabase` via options; only typing needs tightening.

## External Resources

- None required; types exist locally in `types/supabase.ts`.

## Constraints & Risks

- Must not break call sites expecting the existing options shape.
- Minimal risk; purely type tightening.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Update the `supabase` type to `SupabaseClient<Database>` (schema-typed) to remove `any` while preserving compatibility with existing Supabase client instances used elsewhere.
