---
task: nabatable-prod-deployment-404
timestamp_utc: 2025-11-26T20:20:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Research: Production app.nabatable.com 404

## Requirements

- Functional: app.nabatable.com should serve the production Ops UI (same Next.js deployment) without the Vercel `DEPLOYMENT_NOT_FOUND` error.
- Non-functional: Keep current APIs/booking flows unaffected; no secrets committed.

## Existing Patterns & Reuse

- Ops UI is already built under `src/app/app/...` and works on the same deployment when accessed via `/app` on the primary domain.
- Host-based rewrite logic exists in `src/proxy.ts` to send `app.<root>` traffic to `/app` and to rewrite Ops API routes to `/api/ops/*`, but there is **no active `middleware.ts`**, so this logic is currently inactive.
- `src/proxy.ts` still hard-codes `www.sajiloreserve.com` and relies on `NEXT_PUBLIC_ROOT_DOMAIN`, which is **absent** from the provided production env and from `.env.example`.

## Observations (evidence)

- `curl -I https://app.nabatable.com` → `404 DEPLOYMENT_NOT_FOUND` (Vercel) at 2025-11-26T20:20Z.
- DNS: `dig +short app.nabatable.com` → `216.150.1.1`, `216.150.1.193` (not the usual Vercel `76.76.21.21` edge IP / cname.vercel-dns.com), indicating the subdomain is not correctly attached to the Vercel project.
- `curl -I https://nabatable.com` → 307 to `https://www.nabatable.com/`; `https://www.nabatable.com` returns 200 via Vercel (deployment is healthy on the primary domain).

## External Resources

- Vercel “DEPLOYMENT_NOT_FOUND” typically occurs when the requested domain/alias is not assigned to any active deployment; fix is to add the domain to the project and update DNS to Vercel. (Ref: Vercel docs, linked in plan.)

## Constraints & Risks

- Fix requires DNS + Vercel project access (cannot be done purely in repo).
- Posted production secrets (Supabase service role, anon key, DB password, Resend key) are public in this chat → must rotate and avoid committing.
- Enabling middleware without correct `NEXT_PUBLIC_ROOT_DOMAIN` could break routing for the main domain.

## Open Questions

- Should `app.nabatable.com` land on `/app` automatically or show the marketing home? (Current code intends `/app`.)
- Who owns DNS/Vercel access to add the subdomain alias?
- Should we also expose Ops API via subdomain or keep path-based `/app` usage only?

## Recommended Direction (preliminary)

1. Add `app.nabatable.com` as a custom domain/alias on the production Vercel project and point DNS to `cname.vercel-dns.com` (or A `76.76.21.21`).
2. Set `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` in the production environment (and update `.env.example`).
3. Activate the existing host-based routing by introducing `middleware.ts` that imports `src/proxy.ts`, and replace the hard-coded `www.sajiloreserve.com` with the env-driven root domain to support both root and app subdomains.
4. After DNS propagates, verify with `curl` and a live browser that `app.nabatable.com` serves the Ops UI and API routes resolve without 404s.
