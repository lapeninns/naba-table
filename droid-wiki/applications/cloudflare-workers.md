# Cloudflare Workers

Active contributors: amanshresthaa

## Purpose

Cloudflare Workers handle edge integration tasks such as booking short links and SMS summary gateway behavior. They deploy separately from the Next app.

## Directory layout

```text
cloudflare/
├── booking-short-links/src/
└── sms-summary-gateway/src/
```

## Key abstractions

| Symbol or file                                | Description               |
| --------------------------------------------- | ------------------------- |
| `cloudflare/booking-short-links/src/index.ts` | Short-link worker entry.  |
| `cloudflare/sms-summary-gateway/src/index.ts` | SMS gateway worker entry. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Deployment](../deployment.md), [Communications](../systems/communications.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                            | Purpose           |
| ----------------------------------------------- | ----------------- |
| `cloudflare/booking-short-links/src/core.ts`    | Short-link logic. |
| `cloudflare/booking-short-links/src/storage.ts` | Storage helper.   |
| `cloudflare/sms-summary-gateway/src/job.ts`     | Gateway job.      |
| `tests/cloudflare/booking-short-links.test.ts`  | Worker tests.     |

Related: [Deployment](../deployment.md), [Communications](../systems/communications.md)
