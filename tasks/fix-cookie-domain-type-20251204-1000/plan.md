---
task: fix-cookie-domain-type
timestamp_utc: 2025-12-04T10:00:32Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Supabase cookie domain type error

## Objective

Ensure `server/supabase.ts` passes type checking by providing a properly typed root domain value to `resolveCookieDomain` without altering runtime cookie behavior.

## Success Criteria

- [ ] `pnpm run build` completes without the `resolveCookieDomain` argument type error.
- [ ] Cookie domain logic still falls back to `localhost` when no valid root domain is provided.

## Architecture & Components

- File: `server/supabase.ts`
- Adjustment: Guard `runtimeEnv.NEXT_PUBLIC_ROOT_DOMAIN` with a string check and fallback before calling `resolveCookieDomain`.

## Data Flow & API Contracts

- No API or data contract changes. Supabase client initialization remains the same.

## UI/UX States

- Not applicable (server-side configuration change only).

## Edge Cases

- Env variable present but not a string (e.g., boolean) should default to `localhost`.
- Leading dot or whitespace handled by existing `resolveCookieDomain` helper.

## Testing Strategy

- Run `pnpm run build` (includes Next typecheck) to confirm the type error is resolved.

## Rollout

- No feature flags or runtime rollout needed. Standard merge and deploy.
