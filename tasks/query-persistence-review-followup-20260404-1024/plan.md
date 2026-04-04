---
task: query-persistence-review-followup
timestamp_utc: 2026-04-04T10:24:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Query Persistence Review Follow-up

## Objective

We will tighten the auth-transition persistence logic so reload hydration still preserves authenticated cache continuity while genuine login transitions proactively clear anonymous cache state.

## Success Criteria

- [ ] Reload-style anonymous-to-authenticated hydration still skips `queryClient.clear()`.
- [ ] Genuine login transitions from anonymous persistence to authenticated persistence call `queryClient.clear()`.
- [ ] Scoped validation passes.

## Scope

- Update `src/app/providers.tsx`.
- Record why redirect and Vitest config comments were not changed in this pass.

## Testing Strategy

- Run scoped lint on `src/app/providers.tsx`.
- Run `pnpm typecheck`.

## Verification

- This is a code-only follow-up; no browser verification is required unless the scoped fix expands.
