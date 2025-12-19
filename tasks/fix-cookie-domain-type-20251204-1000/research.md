---
task: fix-cookie-domain-type
timestamp_utc: 2025-12-04T10:00:32Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Supabase cookie domain type error

## Requirements

- Functional: Resolve the TypeScript build failure in `server/supabase.ts` where `resolveCookieDomain` receives a non-string argument.
- Non-functional: Preserve existing cookie domain behavior and supabase client initialization; no runtime behavior regressions.

## Existing Patterns & Reuse

- Cookie domain resolution is centralized in `lib/supabase/cookies.ts` via `resolveCookieDomain`.
- Environment parsing is handled by `lib/env.ts` using typed schemas in `config/env.schema.ts` with `.passthrough()` allowing unknown keys (e.g., `NEXT_PUBLIC_ROOT_DOMAIN`).

## External Resources

- None required (internal type narrowing sufficient).

## Constraints & Risks

- Passing an incorrectly typed root domain could change cookie scoping (e.g., adding a leading dot). Need to ensure fallback remains `localhost` in non-production.
- Keep change localized to avoid side effects in Supabase client creation.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Narrow `runtimeEnv.NEXT_PUBLIC_ROOT_DOMAIN` to a string before use. If not a string, fallback to `localhost`. This satisfies TypeScript and maintains current runtime behavior.
