---
task: nabatable-prod-deployment-404
timestamp_utc: 2025-11-26T20:20:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Add `app.nabatable.com` as a custom domain/alias on the production Vercel project.
- [ ] Point DNS for `app.nabatable.com` to Vercel (`cname.vercel-dns.com` or A `76.76.21.21`); wait for propagation.
- [ ] Add `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` to the production env store and `.env.example`.

## Core

- [ ] Enable host-based routing by exporting `src/proxy.ts` via `src/middleware.ts` and swap the hard-coded domain for the env-driven root domain.
- [ ] Deploy production after env + code updates.

## Verification

- [ ] `dig +short app.nabatable.com` shows Vercel target.
- [ ] `curl -I https://app.nabatable.com` returns 200/302 (no `DEPLOYMENT_NOT_FOUND`).
- [ ] `curl -I https://app.nabatable.com/app` (or `/app/login`) returns 200/302.
- [ ] Manual browser check (Chrome DevTools MCP) on app domain once live.

## Notes

- Assumptions: Vercel + DNS access available; Ops UI remains under `/app`.
- Deviations: none yet.
