---
task: remove-drink-bookings
timestamp_utc: 2026-01-22T10:37:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Reserve booking flow

- Attempted to run Vite dev server (`pnpm exec vite --config reserve/vite.config.ts --host 127.0.0.1 --port 5173`).
- Navigated to `http://127.0.0.1:5173/reserve` (basename `/reserve`).
- App rendered error boundary (“Something went wrong”) due to runtime error; booking wizard did not load.
- Console notes: router basename mismatch at `/`, fallback API base URL warning, React Router error.

### Storybook (reserve)

- `pnpm storybook` failed: `ReferenceError: __dirname is not defined` in `reserve/.storybook/main.ts`.

### Next.js admin UI

- Not run in this environment (dev server requires full env validation).

### Device Emulation / Performance / A11y

- Not completed (blocked by render failure).

## Test Outcomes

- `pnpm test -- 'src/app/api/bookings/route.test.ts' 'src/app/api/bookings/[id]/route.test.ts' 'src/app/api/restaurants/[slug]/schedule/route.test.ts'`
- Result: Vitest executed full suite; 39 test files / 257 tests passed.

## Artifacts

- `tasks/remove-drink-bookings-20260122-1037/artifacts/reserve-error.png`

## Known Issues

- [ ] UI QA blocked: reserve app error boundary; Storybook fails due to `__dirname` in Storybook config.
- [ ] Needs manual QA in a local env with API + Storybook working.

## Sign-off

- [ ] Engineering
- [ ] QA
