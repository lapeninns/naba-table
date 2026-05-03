# Guest and customer

Active contributors: amanshresthaa

## Purpose

Guest and customer concepts connect Supabase auth users, booking contact data, customer history, profile data, and operator customer views.

## Directory layout

```text
server/customers.ts
server/ops/customers.ts
src/app/api/profile/
src/guest/
```

## Key abstractions

| Symbol or file                 | Description         |
| ------------------------------ | ------------------- |
| `server/customers.ts`          | Customer helpers.   |
| `server/ops/customers.ts`      | Ops customer views. |
| `src/app/api/profile/route.ts` | Profile API.        |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Guest portal](../features/guest-portal.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                           | Purpose              |
| ------------------------------ | -------------------- |
| `server/customers.ts`          | Customer domain.     |
| `server/ops/customers.ts`      | Ops customer domain. |
| `src/app/api/profile/route.ts` | Profile route.       |

Related: [Guest portal](../features/guest-portal.md)
