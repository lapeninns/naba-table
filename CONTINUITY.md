# Continuity Ledger

Last updated: 2025-12-21T23:10:54Z

## Goal (incl. success criteria)

- Fix `/app` routing so local/preview uses single-host behavior and production uses subdomain routing; ensure ops sign-in path works.

## Constraints/Assumptions

- Follow SDLC phases; no coding before requirements and plan are reviewed.
- Everything is a task with `tasks/<slug>-YYYYMMDD-HHMM>/` artifacts.
- Manual UI QA via Chrome DevTools MCP required for any UI changes.
- Supabase remote only; secrets never in source.
- Environment: local dev and preview environments need single-host routing; production should keep subdomain routing.

## Key decisions

- Use Next.js Proxy (`src/proxy.ts`) instead of deprecated middleware.
- Single-host routing when `VERCEL_ENV=preview|development` or host is listed in `NEXT_PUBLIC_LOCAL_APP_HOSTS`.
- Ops auth on single-host uses `/app/auth/signin`.

## State

- Implemented single-host routing and updated ops auth redirects to use host-aware ops sign-in path.

## Done

- Renamed middleware to proxy and updated docs/tests.
- Added `lib/auth/host-routing.ts` + `lib/auth/ops-signin.ts` utilities.
- Updated ops layout/pages to redirect to `/app/auth/signin` in single-host mode.
- Updated env examples/docs for `NEXT_PUBLIC_LOCAL_APP_HOSTS`.

## Now

- Provide verification steps for localhost and preview host.

## Next

- Manual local verification: `/app`, `/app/dashboard` on localhost.
- (Optional) run `pnpm vitest src/proxy.test.ts`.

## Open questions (UNCONFIRMED if needed)

- Confirm whether any non-Vercel preview host needs to be added to `NEXT_PUBLIC_LOCAL_APP_HOSTS`.

## Working set (files/ids/commands)

- src/proxy.ts
- lib/auth/host-routing.ts
- lib/auth/ops-signin.ts
- src/app/app/(app)/layout.tsx
- src/app/app/(app)/new-bookings/page.tsx
- src/app/app/(app)/settings/restaurant/layout.tsx
- src/app/app/(app)/settings/tables/page.tsx
- src/proxy.test.ts
- docs/dev-routing.md
- .env.example
- .env.local.example
- tasks/fix-app-route-20251221-2116/\*
