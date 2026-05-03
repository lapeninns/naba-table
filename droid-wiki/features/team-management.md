# Team management

Active contributors: amanshresthaa

## Purpose

Team management handles restaurant memberships and invitations for operators, backed by team access checks, invitation links, and settings UI.

## Directory layout

```text
server/team/
lib/owner/team/
src/app/api/ops/team/
src/app/api/team/invitations/
```

## Key abstractions

| Symbol or file                   | Description          |
| -------------------------------- | -------------------- |
| `server/team/access.ts`          | Access checks.       |
| `server/team/invitations.ts`     | Invitation domain.   |
| `lib/owner/team/invite-links.ts` | Invite link helpers. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Supabase and auth](../systems/supabase-auth.md), [Security](../security.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                       | Purpose      |
| ---------------------------------------------------------- | ------------ |
| `server/team/access.ts`                                    | Access.      |
| `server/team/invitations.ts`                               | Invitations. |
| `src/app/api/ops/team/invitations/route.ts`                | Invite API.  |
| `src/components/features/team/OpsTeamManagementClient.tsx` | Team UI.     |

Related: [Supabase and auth](../systems/supabase-auth.md), [Security](../security.md)
