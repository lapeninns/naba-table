# Auth and profile

Active contributors: amanshresthaa

## Purpose

Auth and profile APIs handle Supabase sign-in, sign-up, callbacks, sign-out, profile data, profile image, and invitation acceptance.

## Directory layout

```text
src/app/api/auth/
src/app/api/profile/
src/app/api/team/invitations/
server/auth/
```

## Key abstractions

| Symbol or file                       | Description |
| ------------------------------------ | ----------- |
| `src/app/api/auth/signin/route.ts`   | Sign-in.    |
| `src/app/api/auth/callback/route.ts` | Callback.   |
| `src/app/api/profile/route.ts`       | Profile.    |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Supabase and auth](../systems/supabase-auth.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                 | Purpose   |
| ------------------------------------ | --------- |
| `src/app/api/auth/signin/route.ts`   | Sign-in.  |
| `src/app/api/auth/signup/route.ts`   | Sign-up.  |
| `src/app/api/auth/callback/route.ts` | Callback. |
| `server/auth/signin-throttle.ts`     | Throttle. |

Related: [Supabase and auth](../systems/supabase-auth.md)
