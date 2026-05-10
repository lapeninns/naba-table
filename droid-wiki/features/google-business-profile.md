# Google Business Profile

Active contributors: amanshresthaa

## Purpose

Google Business Profile connects restaurants to Google, imports business data, manages drafts, and publishes selected sync changes through dual-sync jobs.

## Directory layout

```text
server/google-business-profile/
server/dual-sync/
src/app/api/ops/restaurants/[id]/google-business-profile/
```

## Key abstractions

| Symbol or file                               | Description    |
| -------------------------------------------- | -------------- |
| `server/google-business-profile/workflow.ts` | Workflow.      |
| `server/google-business-profile/client.ts`   | Google client. |
| `server/dual-sync/publish/orchestrator.ts`   | Publish jobs.  |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Google Business and dual sync](../systems/google-business-dual-sync.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                                     | Purpose           |
| ------------------------------------------------------------------------ | ----------------- |
| `server/google-business-profile/workflow.ts`                             | Workflow.         |
| `server/google-business-profile/crypto.ts`                               | Token encryption. |
| `server/dual-sync/state/read.ts`                                         | State reads.      |
| `src/app/app/(app)/settings/restaurant/google-business-profile/page.tsx` | Settings page.    |

Related: [Google Business and dual sync](../systems/google-business-dual-sync.md)
