# Host routing

Active contributors: amanshresthaa, lapeninns

## Purpose

Host routing separates app-host operator traffic from root-host guest/public traffic, redirects wrong-surface paths, rewrites app-host ops pages, rewrites selected API aliases, and guards `/api/ops/**`.

## Directory layout

```text
src/proxy.ts
next.config.js
server/auth/ops-guard.ts
server/auth/qa-ops-session.ts
```

## Key abstractions

| Symbol or file         | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `handleRouting`        | Main proxy decision function.                       |
| `OPS_API_SERVICES`     | App-host API rewrite allowlist.                     |
| `PUBLIC_OPS_API_PATHS` | Callback routes allowed without normal ops session. |
| `requireOpsAuth`       | Validated ops session guard.                        |
| `x-ops-user-id`        | Trusted header set only after auth validation.      |

## How it works

Static/framework paths pass through. App-host `/app/**` prefixes are stripped; root-host `/app/**` transports ops routes in single-host mode or redirects to the app host in multi-host mode. Direct `/api/ops/**` requests run the ops auth guard except public callback paths.

## Integration points

This topic links to [Security](../security.md), [Ops API](../api/ops-api.md), and [Routing host split](../background/routing-host-split.md). Proxy/auth changes are high-risk by default.

## Entry points for modification

## Key source files

| File                                       | Purpose                        |
| ------------------------------------------ | ------------------------------ |
| `src/proxy.ts`                             | Routing logic.                 |
| `server/auth/ops-guard.ts`                 | Ops guard.                     |
| `server/auth/qa-ops-session.ts`            | QA fixture gate.               |
| `tests/e2e/ops-app-host-redirects.spec.ts` | Host routing browser coverage. |
