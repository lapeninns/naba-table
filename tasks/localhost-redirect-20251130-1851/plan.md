---
task: localhost-redirect
timestamp_utc: 2025-11-30T18:51:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Keep localhost/app on localhost

## Objective

Prevent local development requests to `/app/*` from redirecting to `app.nabatable.com` while preserving production redirect behavior.

## Success Criteria

- [ ] Visiting `http://localhost:3000/app/dashboard` stays on localhost and renders the app.
- [ ] Prod logic (root domain -> app subdomain) remains unchanged for non-local hosts.
- [ ] Ops API guard/rewrites continue to function.

## Approach

- Modify `src/middleware.ts` web-host branch to detect localhost/127.0.0.1 and skip cross-domain redirects. Redirect `/app` to app subdomain only when host is not localhost.
- For localhost, allow `/app/*` to pass through (or normalize if needed) without changing host; keep /ops legacy redirect but target same host.

## Testing

- Manual: run `pnpm dev`, load `http://localhost:3000/app/dashboard` and confirm no redirect to nabatable.com.
- Build: `pnpm run build` to ensure middleware compiles.

## Rollout

- Direct change; no flags.
