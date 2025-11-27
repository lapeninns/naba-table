# Local multi-host routing setup

Goal: emulate production root vs app hosts locally so middleware and cookies behave correctly.

## Host mapping

- Root host: `localhost:3000`
- App host: `app.localhost:3000`

### /etc/hosts entries

Add the following (no wildcard needed):

```
127.0.0.1 localhost app.localhost
```

### Start dev server

```
pnpm dev
```

Access:

- Root: http://localhost:3000/
- App: http://app.localhost:3000/

Supabase session cookies are scoped to `.${ROOT_DOMAIN}` (defaults to `localhost`), so auth is shared across the two hosts in dev.

## What to verify

- Root `/app/*` redirects to `app.localhost:3000/app/*` with a single `/app` prefix.
- App host `/app/app*` normalizes to `/app*` (no loops).
- App host non-app paths (e.g., `/auth/signin`) redirect back to root host.
- Ops API rewrite: `http://app.localhost:3000/api/bookings` rewrites to `/api/ops/bookings` and requires an authenticated restaurant member.
- Static assets (`/_next/static/*`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`) are served without redirects.

## Troubleshooting

- If the app host shows the root site, ensure your browser used `http://app.localhost:3000` (not https) and that `/etc/hosts` is in place.
- If auth seems lost between hosts, clear cookies and re-sign in; cookies are shared via `.${ROOT_DOMAIN}`.
- To inspect middleware behavior, use `pnpm test src/middleware.test.ts` (or `vitest run src/middleware.test.ts`) with `NEXT_PUBLIC_ROOT_DOMAIN=example.com` in the test environment.
