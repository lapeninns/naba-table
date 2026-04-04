# User Testing

Testing surface, required testing skills/tools, resource cost classification per surface.

---

## Validation Surface

- **Primary surface**: Browser at `http://app.localhost:3000/floor-plan`
- **Tool**: agent-browser (headless Chromium)
- **Authentication**: Password login at `http://app.localhost:3000/auth/signin`
  - Email: `oldcrown@lapeninns.com`
  - Password: `OldCrown@2025`
- **Dev harness fallback**: `http://localhost:3000/dev/ops-floor-plan`
- **Dev server**: `PORT=3000 pnpm dev`

## Validation Concurrency

- Machine: 64GB RAM, 18 CPU cores
- Dry-run baseline memory used: ~8.31 GB
- Dry-run memory used with dev server + auth/browser flow: ~9.17 GB
- Shared Next.js dev server RSS during dry run: ~2.88 GB
- Recommended max concurrent validators: **5**
- Rationale: using 70% headroom still leaves ample memory/CPU budget for five browser validators sharing one dev server on this machine.

## Flow Validator Guidance: browser

- Prefer the authenticated surface for final validation because the dry run proved the full auth path works in this environment.
- Log in through `http://app.localhost:3000/auth/signin` with the documented validator credentials, then navigate directly to `/floor-plan` because successful sign-in redirects to `/dashboard`.
- Validate both desktop and mobile states.
- Required checks:
  - no `New booking`, `Browse bookings`, `Assign booking`, or similar action copy/buttons remain
  - zone/date/search/time controls update the viewer in place
  - keyboard pan/zoom/reset still works on the canvas
  - selecting a table opens read-only details
  - mobile selection opens a read-only sheet and dismissal clears selection
  - zone/search hiding a selected table closes details without stale content
- If auth/bootstrap regresses, switch to the dev harness and document the fallback in the validation evidence.
