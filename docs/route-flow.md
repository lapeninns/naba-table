# Route Flow Overview

This doc captures how navigation is partitioned across the new surface-specific route groups, how middleware guards access, and where canonical redirects live.

## 1. Surface Groups

```
src/app
├── (guest-public)     # marketing + booking shell
├── (guest-account)    # authenticated guest dashboard/profile/invites
└── (ops)              # restaurant console (public login + app shell)
```

Each group provides its own `layout.tsx`, `error.tsx`, and `not-found.tsx`, so failures never bleed across audiences. Shared chrome (CustomerNavbar/Footer) now lives inside the guest layouts instead of `ClientLayout`.

## 2. Guest Public Flow (`/…`)

| Path                                                                    | Notes                                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/`                                                                     | Hero + restaurant teaser grid.                                                           |
| `/browse`, `/create`, `/checkout`, `/thank-you`                         | Marketing funnel entry points.                                                           |
| `/pricing`, `/privacy-policy`, `/terms`                                 | Canonical legal/marketing pages (legacy `/tos` and `/terms/{venue,togo}` redirect here). |
| `/blog` + `/blog/author`, `/blog/category`, dynamic `/blog/[articleId]` | Explicit index routes avoid collisions with post slugs.                                  |
| `/signin`                                                               | Mode switcher between magic-link and password flows.                                     |
| `/reserve`, `/reserve/[reservationId]`, `/reserve/r/[slug]`             | All mount the Vite SPA via `ReserveApp`, forwarding initial path state.                  |
| `/item/:slug`                                                           | Permanently redirects to `/reserve/r/:slug`.                                             |

## 3. Guest Account Flow (`/my-bookings`, `/profile`, `/invite`)

These pages assume an authenticated Supabase session. Middleware redirects unauthenticated users to `/signin?redirectedFrom=…`. Key routes:

| Path              | Notes                                                       |
| ----------------- | ----------------------------------------------------------- |
| `/my-bookings`    | Reservation list with filters.                              |
| `/profile/manage` | Account details + avatar upload.                            |
| `/invite/[token]` | Accept team invite; renders error state when token invalid. |

## 4. Ops Flow (`/ops/…`)

Structure lives under `src/app/(ops)/ops/` with `(public)` for `/ops/login` and `(app)` for the authenticated console. Middleware behavior:

1. Unauthed access → `/ops/login?redirectedFrom=/ops/...`.
2. Auth is inferred from Supabase cookies (`sb-access-token`, etc.).
3. Additional role-based logic remains inside server components (e.g., `OpsAppLayout`).

Primary app routes:

| Path                                                                 | Description                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/ops`                                                               | Dashboard landing.                                                     |
| `/ops/bookings`, `/ops/bookings/new`                                 | Booking management + walk-in wizard.                                   |
| `/ops/capacity`, `/ops/tables`, `/ops/customer-details`, `/ops/team` | Console modules.                                                       |
| `/ops/restaurant-settings`                                           | Owner configuration area.                                              |
| `/ops/rejections`                                                    | Guarded by `env.featureFlags.opsRejectionAnalytics`; 404s if disabled. |
| `/ops/(public)/login`                                                | Standalone login surface (shares `/signin?context=ops`).               |

## 5. Middleware & Auth Guards (`middleware.ts`)

- Sanitizes `redirectedFrom` to a safe allowlist of on-site paths.
- Blocks `/api/test/*` and `/api/v1/test/*` in production.
- Adds `Deprecation` + `Sunset` headers to non-v1 API responses.
- Redirect rules:
  - Guest account routes (`/my-bookings`, `/profile`, `/invite`) → `/signin` when unauthenticated.
  - Ops routes (except `/ops/login`) → `/ops/login`.
- Adds `Referrer-Policy: no-referrer` on `/thank-you`.

## 6. SEO: Robots & Sitemap

- `src/app/robots.ts` disallows `/ops/*` and `/api/*`, and points crawlers to the generated sitemap.
- `src/app/sitemap.ts` emits only guest-public URLs (marketing, legal, signin, etc.).

## 7. Canonical Redirects (`next.config.js`)

```js
[
  { source: '/item/:slug', destination: '/reserve/r/:slug', permanent: true },
  { source: '/tos', destination: '/terms', permanent: true },
  { source: '/terms/venue', destination: '/terms', permanent: true },
  { source: '/terms/togo', destination: '/terms', permanent: true },
];
```

## 8. Testing

`tests/e2e/auth/auth-redirects.spec.ts` verifies:

- Guest account routes bounce to `/signin`.
- Ops routes bounce to `/ops/login`.
- Legal aliases hit `/terms`.

Add more Playwright specs here as you expand auth or canonical behaviors.
