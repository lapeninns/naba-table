---
task: supabase-cookie-runtime-error
timestamp_utc: 2025-11-22T23:14:25Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Research: Supabase cookie write runtime error in Next.js 16 dev

## Requirements

- Functional: prevent runtime crashes in dev caused by Supabase auth cookie writes while keeping session handling intact.
- Non-functional: avoid unhandled promise rejections; adhere to Next.js 16 cookies restrictions; no regression to authentication or middleware behaviors.

## Existing Patterns & Reuse

- `server/supabase.ts` centralizes Supabase clients and a `createCookieAdapter` that forwards `cookies().set` to Supabase SSR.
- Next.js error logs show `createCookieAdapter` `setAll` invoking `cookieWriter.set`, which Next blocks in server component contexts.

## External Resources

- [Next.js cookies docs](https://nextjs.org/docs/app/api-reference/functions/cookies#options) — documents restriction that cookies can only be modified in server actions/route handlers.
- Supabase SSR Next.js example wraps `setAll` in `try/catch` to ignore write attempts during server component rendering.

## Constraints & Risks

- Disabling/ignoring cookie writes in server components may rely on middleware or route handlers to refresh sessions; need to ensure no auth regression.
- No database or Supabase environment changes allowed (remote-only per policy).
- Must maintain accessibility and existing client interfaces.

## Open Questions (owner, due)

- Do we have middleware already refreshing Supabase sessions so skipping writes is safe? (owner: assistant, due: during implementation)

## Recommended Direction (with rationale)

- Update `createCookieAdapter.setAll` to handle disallowed cookie writes gracefully (try/catch + debug log), matching Supabase Next.js guidance. This prevents runtime crashes while keeping write support in contexts where it is allowed (route handlers/middleware).
