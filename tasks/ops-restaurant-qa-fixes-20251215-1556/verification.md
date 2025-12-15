---
task: ops-restaurant-qa-fixes
timestamp_utc: 2025-12-15T15:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report: Ops Restaurant QA Fixes

## Automated Checks

- ✅ `pnpm typecheck`
- ✅ `pnpm build`
- ⚠️ `pnpm test` fails (appears pre-existing; not introduced by these changes)

Notes:

- Repo declares Node `20.11.1`, but this environment runs Node `22.12.0` (pnpm emits an engine warning). `next dev` was unstable due to file-watcher limits; verification was performed in production build mode (`next build` + `next start`) instead.

## Manual QA (Chrome DevTools MCP)

### Security headers (root + app host)

Verified presence of baseline headers (CSP minimal, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy) on:

- Root host: `http://localhost:3000/`
- App host redirect entry: `http://app.localhost:3000/dashboard` (redirects to ops sign-in when unauthenticated)

Artifacts:

- `tasks/ops-restaurant-qa-fixes-20251215-1556/artifacts/security-headers-root.txt`
- `tasks/ops-restaurant-qa-fixes-20251215-1556/artifacts/security-headers-app-dashboard.txt`
- `tasks/ops-restaurant-qa-fixes-20251215-1556/artifacts/root-home.png`
- `tasks/ops-restaurant-qa-fixes-20251215-1556/artifacts/app-auth-signin.png`

### Offline + floor-plan verification (blocked)

The remaining QA items require an authenticated ops session:

- Offline banner + pagination guard behavior on `/bookings` and `/customers`
- `/seating/floor-plan` throttled performance trace (Fast 3G + 4× CPU) to confirm render-delay reduction

Blockers encountered in this environment:

1. No ops staff credentials available to log into `http://app.localhost:3000/auth/signin`.
2. Local test-session provisioning endpoint `/api/test/playwright-session` cannot be used because Supabase Auth admin API calls return `500` (“Database error finding users”) when calling `auth.admin.listUsers()` against the configured Supabase project.

### Repeatable checklist for maintainers (once creds/session available)

1. Start server in production mode:
   - `pnpm build && pnpm start`
2. Log into ops at:
   - `http://app.localhost:3000/auth/signin`
3. Offline navigation:
   - DevTools → Network → Offline
   - Confirm:
     - Sidebar nav links show toast and do not navigate
     - “Next/Previous” pagination on `/bookings` and `/customers` does not navigate or change page while offline
4. Floor plan performance:
   - DevTools → Performance
   - Throttle: Fast 3G + 4× CPU
   - Load `http://app.localhost:3000/seating/floor-plan`
   - Confirm LCP is not dominated by render delay; check for reduced main-thread long tasks and no large CLS spikes on load.
