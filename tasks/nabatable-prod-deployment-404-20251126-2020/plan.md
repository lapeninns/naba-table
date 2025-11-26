---
task: nabatable-prod-deployment-404
timestamp_utc: 2025-11-26T20:20:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restore app.nabatable.com

## Objective

Make `app.nabatable.com` serve the production Ops UI (same Next.js deployment) without Vercel `DEPLOYMENT_NOT_FOUND`, while keeping www/root traffic unaffected.

## Success Criteria

- `https://app.nabatable.com/` returns a Next.js response (200/302 to login) instead of `DEPLOYMENT_NOT_FOUND`.
- Requests on the app subdomain to Ops APIs (e.g., `/api/bookings`) route to `/api/ops/*` as intended.
- www.nabatable.com and primary marketing flows remain unchanged.
- No secrets committed; production keys rotated after being exposed in chat.

## Architecture & Components

- **DNS + Vercel domain alias**: Add `app.nabatable.com` to the production Vercel project; configure DNS (CNAME to `cname.vercel-dns.com` or A `76.76.21.21`).
- **Env**: Add `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` to the production environment (and `.env.example`).
- **Middleware**: Activate host-based routing by exporting `src/proxy.ts` via `src/middleware.ts` and replace hard-coded domain checks with the root-domain env.

## Data Flow & API Contracts

- Host `app.<root>` → rewrite UI requests to `/app/*` and Ops APIs `/api/{service}` → `/api/ops/{service}` (except public restaurant schedule endpoints).
- Root domain (`nabatable.com` / `www`) continues to serve marketing + guest flows without rewrites.

## UI/UX States

- App subdomain root should land on Ops login/dashboard (existing `/app` routes). Marketing pages remain on the root domain.

## Edge Cases

- API routes outside the Ops allowlist (auth, webhooks) must bypass rewrites.
- Ensure env is defined; otherwise host checks fall through and could degrade routing if middleware is enabled.
- DNS propagation delay; avoid toggling multiple times within TTL.

## Testing Strategy

- `dig +short app.nabatable.com` shows Vercel target (CNAME or `76.76.21.21`).
- `curl -I https://app.nabatable.com` → 200/302 (no `DEPLOYMENT_NOT_FOUND`).
- `curl -I https://app.nabatable.com/app` or `/app/login` returns 200/302 (ensures rewrite works once middleware is live).
- Spot-check `/api/bookings` with an authenticated session (or ensure path rewrites via logs). Manual browser check via Chrome DevTools once DNS is live.

## Rollout

1. Add domain alias in Vercel + update DNS (production project).
2. Add `NEXT_PUBLIC_ROOT_DOMAIN` env; redeploy production.
3. Enable middleware routing (small code change), deploy; verify both domains.
4. Rotate exposed Supabase/Resend secrets and update env store.
5. Roll back by removing the domain alias or disabling middleware if issues occur.
