---
task: fix-inline-auto-assign-client
timestamp_utc: 2026-01-01T11:25:51Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix inline auto-assign client propagation

## Requirements

- Functional:
  - Ensure `runInlineAutoAssign` forwards the supplied Supabase client to all downstream DB operations.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: avoid cross-environment/tenant leakage by scoping DB calls to the caller's client.

## Existing Patterns & Reuse

- TBD after codebase review of inline auto-assign and existing Supabase client usage in services.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases and keep edits minimal.
- Supabase usage must remain remote-only (no local DB actions).

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Pass the provided Supabase client through to `quoteTablesForBooking` and `atomicConfirmAndTransition` to keep DB scope consistent and avoid environment leakage.
