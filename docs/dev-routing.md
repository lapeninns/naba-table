# Local multi-host routing setup

Goal: emulate production root vs app hosts locally so proxy routing and cookies behave correctly.

## Host mapping

- Root host: `localhost:3000`
- App host: `app.localhost:3000` (or `app.localhost.com:3000` if you prefer the `.com` suffix)

### /etc/hosts entries

Add the following (no wildcard needed):

```
127.0.0.1 localhost app.localhost
# optional if you want `.com` locally
127.0.0.1 localhost.com app.localhost.com
```

### Start dev server

```
pnpm dev
```

Access:

- Root: http://localhost:3000/
- App (optional subdomain test): http://app.localhost:3000/

### Single-host mode (preview/local)

In preview/local environments (e.g. Vercel `VERCEL_ENV=preview`) the proxy keeps `/app/*` on the same host and uses `/app/auth/signin` for ops auth.
If you need to force single-host behavior on a custom host, set:

```
NEXT_PUBLIC_LOCAL_APP_HOSTS=frontend-2025-dec19.vercel.app,frontend-2025-dec19.local
```

Supabase session cookies are scoped to `.${ROOT_DOMAIN}` (defaults to `localhost`), so auth is shared across the two hosts in dev.

## What to verify

- Root `/app/*` stays on localhost in dev (no subdomain redirect) and resolves via the app route group.
- Preview/override hosts listed in `NEXT_PUBLIC_LOCAL_APP_HOSTS` behave like single-host mode.
- App host `/app/app*` normalizes to `/app*` (no loops).
- App host non-app paths (e.g., `/auth/signin`) redirect back to root host.
- Ops API rewrite: `http://app.localhost:3000/api/bookings` rewrites to `/api/ops/bookings` and requires an authenticated restaurant member.
- Static assets (`/_next/static/*`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`) are served without redirects.

## Troubleshooting

- If the app host shows the root site, ensure your browser used `http://app.localhost:3000` (not https) and that `/etc/hosts` is in place.
- If auth seems lost between hosts, clear cookies and re-sign in; cookies are shared via `.${ROOT_DOMAIN}`.
