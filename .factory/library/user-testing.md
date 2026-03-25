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
- When validating guest-system consistency, capture representative screenshots across:
  - marketing/discovery
  - auth
  - booking lifecycle
  - portal (mocked if necessary)
- If multi-host guest/app canonicalization cannot be exercised in the current runtime, record the blocker and rely on deterministic automated coverage rather than silently skipping the assertion.

## Mocked Portal Guidance

- Keep mocked fixtures coherent across dashboard, bookings, and profile for the same guest identity.
- Prefer assertions that are stable under mocked portal validation:
  - shell consistency
  - primary actions
  - upcoming/past tab behavior
  - empty/loading/error states
  - non-editable email and profile form feedback
