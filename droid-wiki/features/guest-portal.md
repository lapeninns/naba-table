# Guest portal

Active contributors: amanshresthaa

## Purpose

The guest portal lets signed-in diners view dashboards, bookings, details, receipts, and profile data. Server view models prefetch guest data for hydrated clients.

## Directory layout

```text
src/app/guest/
src/guest/
src/components/features/guest/
src/app/api/profile/
```

## Key abstractions

| Symbol or file                 | Description            |
| ------------------------------ | ---------------------- |
| `src/guest/services/server.ts` | Server guest adapters. |
| `GuestDashboardClient`         | Dashboard UI.          |
| `GuestProfileClient`           | Profile UI.            |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Supabase and auth](../systems/supabase-auth.md), [Guest and customer](../primitives/guest-customer.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                               | Purpose           |
| ------------------------------------------------------------------ | ----------------- |
| `src/app/guest/dashboard/page.tsx`                                 | Dashboard page.   |
| `src/guest/services/server.ts`                                     | Server adapters.  |
| `src/app/api/profile/route.ts`                                     | Profile API.      |
| `src/components/features/guest/dashboard/GuestDashboardClient.tsx` | Dashboard client. |

Related: [Supabase and auth](../systems/supabase-auth.md), [Guest and customer](../primitives/guest-customer.md)
