---
name: qa-reserve
description: >
  QA tests for the reserve Vite app, focusing on reservation entry routes and
  guest-facing reservation UX in the standalone reserve package.
---

# QA Reserve

## Testing Target

Use the local branch code by starting the reserve dev server:

1. Start `pnpm reserve:dev -- --host 127.0.0.1 --port 5174`
2. Poll `http://127.0.0.1:5174` until ready
3. Run browser tests against that local URL

If the server cannot be started, report reserve checks as `BLOCKED`.

**Never substitute a remote environment for branch verification.**

## Authentication in CI / Automation

Typical reserve env vars:

- `NEXT_PUBLIC_RESERVE_API_BASE_URL`
- `NEXT_PUBLIC_RESERVE_API_TIMEOUT_MS`
- `NEXT_PUBLIC_RESERVE_ROUTER_BASE_PATH`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Reserve flows are usually guest-facing and do not require an ops persona unless the diff explicitly adds such coupling.

## App-Specific Notes

- The reserve app is a standalone Vite surface under `reserve/**`.
- Existing route coverage indicates these important entry points:
  - `/`
  - `/new`
  - `/:reservationId`
  - restaurant reservation flows that consume restaurant schedule/availability APIs
- API dependencies may be mocked in automated tests, but QA should interact with the running app behavior first.

## Flow Menu

Choose only flows relevant to the diff.

### 1. Entry and route resolution

- `/`
- `/new`
- `/:reservationId`
- not-found routing

### 2. Reservation planning flow

- choose date/time/party size
- move through plan/review steps
- confirm validation and guidance states

### 3. Availability and schedule rendering

- schedule loading
- slot rendering
- closed/unavailable states
- timezone-aware copy when relevant

### 4. Draft persistence and recovery

- wizard draft persistence
- timeout/recovery flows
- negative check: invalid or stale draft state

### 5. API error handling

- restaurant lookup failures
- booking submission errors
- missing schedule data

## Persona Variations

- **guest**: primary persona for all reserve flows.
- **new_user**: useful for fresh reservation/session flows with no prior state.

## Error Handling

- If the reserve app depends on backend APIs that are unavailable locally, report `BLOCKED` unless the diff can still be verified with the running UI state.
- Prefer direct verification of visible step titles, validation copy, and route behavior.

## Known Failure Modes

1. **Reserve needs its own dev server.** `pnpm dev` is not sufficient for the standalone reserve package.
2. **API base URL mismatches can blank the flow.** Missing `NEXT_PUBLIC_RESERVE_API_BASE_URL` or related env can block availability/loading states.
3. **Route-only diffs still need navigation proof.** Verify `/`, `/new`, and reservation detail routing when route files change.
