# Menu and drinks

Active contributors: amanshresthaa

## Purpose

Menu and drinks management imports and edits restaurant food and drink items through ops settings, repository modules, and import parsers.

## Directory layout

```text
server/menu/
server/drinks-menu/
src/app/api/ops/restaurants/[id]/menu/
src/app/api/ops/restaurants/[id]/drinks/
```

## Key abstractions

| Symbol or file                 | Description      |
| ------------------------------ | ---------------- |
| `server/menu/import.ts`        | Menu import.     |
| `server/menu/repository.ts`    | Menu repository. |
| `server/drinks-menu/import.ts` | Drinks import.   |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Restaurant settings](restaurant-settings.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                       | Purpose          |
| ---------------------------------------------------------- | ---------------- |
| `server/menu/import.ts`                                    | Menu import.     |
| `server/menu/repository.ts`                                | Menu repository. |
| `server/drinks-menu/import.ts`                             | Drinks import.   |
| `src/components/features/menu/OpsMenuManagementClient.tsx` | Menu UI.         |

Related: [Restaurant settings](restaurant-settings.md)
