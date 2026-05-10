# Feature flags

Active contributors: amanshresthaa

## Purpose

Feature flags control allocation, lifecycle, queue, metrics, rejection analytics, realtime, and integration behavior.

## Directory layout

```text
lib/env.ts
server/feature-flags.ts
server/feature-flags-overrides.ts
lib/feature-flags/
```

## Key abstractions

| Symbol or file                   | Description                   |
| -------------------------------- | ----------------------------- |
| `env.featureFlags`               | Parsed flags in `lib/env.ts`. |
| `server/feature-flags.ts`        | Server resolvers.             |
| `scripts/feature-flags/audit.ts` | Audit script.                 |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Configuration](../reference/configuration.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                | Purpose       |
| ----------------------------------- | ------------- |
| `lib/env.ts`                        | Parsed flags. |
| `server/feature-flags.ts`           | Resolvers.    |
| `server/feature-flags-overrides.ts` | Overrides.    |
| `scripts/feature-flags/audit.ts`    | Audit.        |

Related: [Configuration](../reference/configuration.md)
