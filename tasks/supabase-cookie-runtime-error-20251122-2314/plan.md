---
task: supabase-cookie-runtime-error
timestamp_utc: 2025-11-22T23:14:25Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Supabase cookie write runtime error

## Objective

Ensure Supabase SSR client usage no longer triggers Next.js 16 "Cookies can only be modified in a Server Action or Route Handler" errors while preserving session handling.

## Success Criteria

- [ ] `pnpm run dev` can serve `/` without unhandled rejections or cookie write errors.
- [ ] Supabase cookie writes still function in route handlers/middleware where allowed.

## Architecture & Components

- `server/supabase.ts`: adjust `createCookieAdapter` to tolerate disallowed cookie writes when rendering server components; keep writer behavior for handlers that permit it.

## Data Flow & API Contracts

- Supabase client setup remains unchanged; only cookie adapter error handling is updated. No API surface or schema changes.

## UI/UX States

- No UI changes; only backend runtime stability.

## Edge Cases

- Rendering server components that trigger session refresh should not crash even if cookie writes are blocked.
- Middleware/route handlers should still write cookies successfully.

## Testing Strategy

- Manual: run `pnpm run dev`, hit `/`, observe no repeated cookie errors.
- Automated: rely on existing TypeScript checks; optionally run `pnpm run lint` if time permits.

## Rollout

- No feature flag; change is safe to roll out immediately after verification.

## DB Change Plan (if applicable)

- Not applicable (no DB changes).
