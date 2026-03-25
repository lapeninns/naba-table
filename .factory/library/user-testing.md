# User Testing

Testing surface, required testing skills/tools, resource cost classification per surface.

---

## Validation Surface

- **Primary tool**: `agent-browser`
- **Live browser surface**: `http://localhost:3000`
- **Live routes confirmed in dry run**:
  - `/`
  - `/auth`
  - `/auth/signin`
  - `/bookings`
  - unauthenticated redirects from `/guest/*`
- **Accepted limitation**: authenticated guest-portal validation will use mocked portal validation for this mission unless a stable real guest fixture is later introduced
- **Real guest auth/bootstrap**: not currently assumed available for validator work
- **Use live smoke checks for**:
  - public landing/discovery
  - guest auth entry
  - booking/recovery/receipt redirects and canonicalization
- **Use mocked authenticated fixtures for**:
  - `/guest/dashboard`
  - `/guest/bookings`
  - `/guest/profile`

## Validation Concurrency

- Machine: 64GB RAM, 18 CPU cores
- Dry-run observation: browser validation is CPU-bound before RAM-bound on this machine
- Conservative max concurrent browser validators: **6**
- Do not exceed **6** concurrent guest-surface validators unless the orchestrator explicitly updates this file

## Flow Validator Guidance

- Prefer live browser validation on `http://localhost:3000` for guest/public/auth/redirect flows.
- Prefer mocked authenticated validation for portal dashboard/bookings/profile flows.
- When validating route canonicalization, capture:
  - starting URL
  - final URL
  - visible destination state
  - any redirect chain evidence available
- If proxy or middleware behavior changed, restart or hot-reload the port `3000` app from the worktree before relying on live browser validation; stale dev servers may continue serving old redirect headers even when tests and source are correct.
- When Playwright must reuse the already-running dev server on port `3000`, set `PLAYWRIGHT_DEV_HARNESS=1` before invoking the spec. The guest mission's live-surface specs rely on that env var to avoid booting a second app instance.
- When validating guest-system consistency, capture representative screenshots across:
  - marketing/discovery
  - auth
  - booking lifecycle
  - portal (mocked if necessary)
- If multi-host guest/app canonicalization cannot be exercised in the current runtime, record the blocker and rely on deterministic automated coverage rather than silently skipping the assertion.

## Known Local Runtime Limitation

- For `VAL-FOUNDATION-013`, the local Next.js dev runtime may still surface a relative redirect / browser loop on `app.localhost` guest paths even when the canonical middleware contract is correct in deterministic coverage.
- If this happens:
  - capture the live browser/curl symptom,
  - confirm the canonical redirect contract with `tests/guest/public-booking-redirects.test.ts`,
  - confirm the root-host guest flow works once on `http://localhost:3000/guest/...`,
  - treat the remaining `app.localhost` loop as a local-dev runtime limitation unless it reproduces outside the local Next dev environment.

## Mocked Portal Guidance

- Keep mocked fixtures coherent across dashboard, bookings, and profile for the same guest identity.
- Prefer assertions that are stable under mocked portal validation:
  - shell consistency
  - primary actions
  - upcoming/past tab behavior
  - empty/loading/error states
  - non-editable email and profile form feedback

## Flow Validator Guidance: browser

- Use `agent-browser` for live browser validation against `http://localhost:3000` unless a Playwright-only mocked surface is explicitly required.
- Stay within assigned guest/public/auth/portal routes and do not navigate into unrelated ops/admin flows except when capturing evidence that guest routes avoid ops chrome.
- Treat `app.localhost` guest-route validation as isolated redirect-only coverage: capture start URL, final URL, and visible result, then stop.
- For mocked portal checks, keep one coherent fixture identity across `/guest/dashboard`, `/guest/bookings`, and `/guest/profile`.
- Do not mutate shared authenticated state or reusable fixtures outside the assigned assertion group.

## Local Discovery / Booking Validation Notes

- Use `seed-perf-r001` as the current stable local public restaurant slug for live guest discovery/detail/booking validation on port `3000`.
- Earlier probes (`the-fox`, `white-horse-pub-waterbeach`) were unavailable or unstable in prior local runs; prefer `seed-perf-r001` unless a later worker updates this note with a newer verified fixture.
- Playwright updates `test-results/.last-run.json` during local runs; this file may appear dirty after validation and should not be mistaken for a product change.

## Guest UI Runtime Pitfalls

- Do not pass Lucide component constructors across React Server Component → client guest loading boundaries (for example `icon={LoaderCircle}` from a server `loading.tsx` into a client component). Inline the icon element or keep the boundary fully client-side; otherwise the route can crash with a serialization/runtime failure.
