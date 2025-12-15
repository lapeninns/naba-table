---
task: devtools-restaurant-qa
timestamp_utc: 2025-12-15T11:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report: Chrome DevTools QA (Restaurant-Facing Routes)

QA completed using Chrome DevTools MCP (performance traces, network/console inspection, device emulation) against the restaurant-facing (Ops) UI on the local app host.

## Environment

- Date (UTC): 2025-12-15
- App host (local): `http://app.localhost:3000`
- Build mode: Dev server (`next dev`)

### Routes Covered (restaurant-facing)

- Public: `/auth/signin`
- Authenticated: `/dashboard`, `/bookings`, `/new-bookings`, `/customers`, `/seating/floor-plan`, `/seating/capacity`, `/settings/restaurant/profile`, `/settings/restaurant/operating-hours`, `/settings/restaurant/service-periods`, `/settings/restaurant/occasions`, `/settings/restaurant/team`, `/settings/tables`
- Redirect checks: `/` → `/dashboard`, `/settings` → `/settings/restaurant/profile`, `/seating` → `/seating/floor-plan`, `/app/bookings` → `/bookings`, `/management` → `/management/team` → `/settings/restaurant/team`

### Severity Scale

- **P0 (Critical)**: Security/data exposure, account compromise, or complete feature outage.
- **P1 (High)**: Major degradation (offline/slow devices), broken core flows, or high-risk security posture.
- **P2 (Medium)**: Noticeable UX regressions, performance issues nearing budgets, or a11y gaps with workarounds.
- **P3 (Low)**: Minor issues, best-practice gaps, polish.
- **P4 (Info)**: Observations / opportunities.

---

## 1) Performance Testing

### Findings

- **P1** — `/seating/floor-plan` becomes extremely slow under simulated constraints (Fast 3G + 4× CPU): **LCP ~9.0s**, dominated by render delay (main-thread work). See `artifacts/performance-metrics.json`.
  - Risk: real restaurant devices/tablets can approximate this profile under load (battery saver, background tabs, older hardware).
- **P2** — High TTFB variability on document loads in dev traces:
  - `/dashboard`: TTFB ~1.55s (LCP ~2.00s)
  - `/customers`: TTFB ~1.94s (LCP ~2.06s)
  - `/bookings`: TTFB ~0.63s (LCP ~0.73s)
- **P3** — `/seating/floor-plan` shows CLS ~0.07 (within “Good” threshold), with a culprit cluster related to a non-composited `spin` animation.
- **P4** — “Forced reflow” flagged during throttled runs is attributable to dev-only tooling (TanStack Query Devtools) in this environment; verify in production build where devtools aren’t bundled.

### Recommendations

- Prioritize `/seating/floor-plan` low-end-device performance:
  - Reduce initial render complexity (virtualize or progressively render table buttons/overlays; avoid rendering all zones/tables at once if not needed).
  - Audit layout thrash/forced reflow contributors in production mode; ensure heavy computations are memoized and moved off the critical render path.
  - Avoid non-composited animations that can affect layout (prefer `transform`/`opacity` only; ensure spinners don’t trigger layout shifts).
- Investigate TTFB for `/dashboard` and `/customers`:
  - Confirm if slow server response is caused by server components waiting on ops API calls, DB queries, or cold caches.
  - Add lightweight server-side caching where safe (per-restaurant, short TTL) for “list” endpoints.
- Re-run performance with a production server (`next build && next start`) to confirm budgets without dev overhead.

Artifacts:

- `artifacts/performance-metrics.json`
- `artifacts/memory-sampling.json`

---

## 2) Network & API Testing

### Findings

- **P2** — Ops API latency is noticeable for core endpoints (measured from the client without parsing payloads to avoid capturing PII):
  - `ops_restaurant`: ~0.9–1.0s
  - `ops_bookings`: ~0.7s
  - `ops_bookings_status_summary`: ~0.8s
    See `artifacts/api-timings.json`.
- **P1** — Offline scenario has a sharp failure mode:
  - When network emulation is set to “Offline”, the UI correctly displays an “You are offline / Navigation is paused” banner; however, interacting with pagination led to a full browser offline error page (`ERR_INTERNET_DISCONNECTED`) rather than an in-app handled error state.
  - This indicates at least one control still triggers navigation while offline (should be disabled or handled).
- **P4** — Dev build uses `Cache-Control: no-store` for many resources; caching behavior in prod cannot be inferred from local dev traces.

### Recommendations

- Improve offline resilience:
  - When offline banner is active, disable route-changing controls (pagination, nav links, etc.) and/or keep users in-app with a “cannot load while offline” toast.
  - Consider a retry strategy that does not hard-navigate (prefer client-side re-fetch with errors shown inline).
- Reduce perceived latency:
  - Preload restaurant metadata and status summaries concurrently (ensure no waterfalls).
  - Add skeleton loading states for bookings/customers lists; keep previous data visible while refetching.
- Validate production caching:
  - Ensure `_next/static/*` assets are `immutable` with long cache TTL.
  - Confirm API endpoints set appropriate `Cache-Control` (typically `no-store` for authenticated PII; possibly short-lived caching for derived metrics if safe).

Artifacts:

- `artifacts/api-timings.json`
- Screenshots (responsive checks): `artifacts/*-*.png`

---

## 3) Security & Console Testing

### Findings

- **P1** — Security headers appear absent in local responses (example: `/auth/signin` only returns standard Next headers + CSRF cookie). No CSP, X-Content-Type-Options, Referrer-Policy observed on local HTTP responses.
  - Note: local dev is not TLS; certificate/HSTS checks are not applicable on `http://`.
- **P2** — Console warning from Supabase SDK:
  - Warns against trusting `getSession()`’s `user` object without verification; prefer `getUser()` for authenticated user data.
  - This is a best-practice warning; if any authz logic relies on unverified session user objects, that becomes a real vulnerability.
- **P3** — Chrome “issue”: “A form field element should have an id or name attribute” (autofill/a11y hint).
- **P4** — No runtime JS exceptions observed during normal navigation in the restaurant routes tested.

### Recommendations

- Add explicit security headers (prod and dev parity):
  - CSP (at minimum: disallow `object-src`, lock down `frame-ancestors`, and constrain script/style origins).
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (disable unused sensors/APIs)
  - For prod HTTPS: `Strict-Transport-Security` (HSTS) with preload (if domain strategy supports it).
- Audit Supabase auth usage:
  - Ensure all server-side checks (middleware / route handlers) rely on `auth.getUser()` or verified JWTs, not cached session objects.
- Fix missing `id`/`name` on form controls flagged by Chrome issue tooling.

Artifacts:

- `artifacts/console-summary.json`

---

## 4) Responsive & Device Testing

### Findings

- **P4** — Layouts render successfully at the tested breakpoints (no obvious overflow/scrollbar regressions on the sampled pages).
- **P3** — Floor plan UI is dense on mobile; check that touch targets remain ≥44px and that horizontal scrolling / zoom behavior is intentional for the timeline slider.

### Recommendations

- Verify critical flows on touch devices:
  - Seating table selection, timeline scrubber, and booking actions should be usable one-handed.
  - Ensure `:focus-visible` rings remain visible on keyboard + assistive tech.

Artifacts (screenshots):

- Dashboard: `artifacts/dashboard-*.png`
- Bookings (empty-state to avoid PII): `artifacts/bookings-*.png`
- Floor plan: `artifacts/floor-plan-*.png`

---

## 5) Accessibility Testing

### Findings

- **P3** — Chrome DevTools surfaced at least one form-field semantics issue (missing `id`/`name`).
- **P4** — Positive signals from DOM snapshots:
  - Skip links exist on both sign-in and authenticated shells.
  - Controls include accessible roles/labels (e.g., tablist on sign-in mode selector; labeled search inputs).

### Limitations (Lighthouse)

Lighthouse CLI could not be executed in this environment due to Chrome Crashpad permission restrictions (Chrome failed to start headlessly under the sandbox). A Lighthouse JSON artifact could not be generated.

### Recommendations

- Run Lighthouse a11y audits from a non-sandboxed environment (example command):
  - `npx lighthouse https://app.<domain>/auth/signin --only-categories=accessibility --output=json --output-path=./lighthouse-auth-signin.json`
- Add automated a11y checks (axe) for critical routes in CI where feasible, especially for the Ops shell and bookings table actions.

---

## 6) Application State & Storage Testing

### Findings

- **P4** — Storage footprint is small and understandable:
  - `document.cookie` exposes only `sr-csrf-token` (good; auth cookies should remain HttpOnly).
  - `localStorage` keys observed: `ops.activeRestaurantId`, `reserve.query-cache`, `srx.analytics.anonId`.
  - No IndexedDB databases detected.
  - No service worker registrations detected (no Cache Storage entries).

### Recommendations

- Keep auth cookies HttpOnly and avoid storing tokens in localStorage.
- If offline support is a product requirement, consider adding explicit SW/PWA strategy; otherwise, ensure the offline banner disables navigation that could hard-fail.

Artifacts:

- `artifacts/storage-summary.json`

---

## Artifacts

- Stored in `tasks/devtools-restaurant-qa-20251215-1156/artifacts/`
