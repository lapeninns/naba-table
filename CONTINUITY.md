# Continuity Ledger

Last updated: 2026-03-25T06:53:30Z

## Goal (incl. success criteria)

- Refresh the worktree-backed Next.js runtime on port 3000 and fix the remaining live app-host guest-route canonicalization failure for `http://app.localhost:3000/guest/bookings?tab=upcoming`.
- Success means the live runtime serves current worktree middleware/proxy code, guest-owned app-host URLs redirect exactly once to the guest/root host before auth gating, and the required validators plus live checks pass.

## Constraints/Assumptions

- Follow mission/worker AGENTS guidance and stay within the isolated worktree.
- Reuse the existing Next.js app on port 3000 via `.factory/services.yaml`; do not touch off-limits ports.
- Scope is limited to guest route ownership/runtime refresh behavior; do not expand into unrelated guest UI work.
- `pnpm lint` may still emit the known pre-existing warnings documented by the mission AGENTS file.

## Key decisions

- Inspect the live runtime path through `src/proxy.ts` and compare it against the pure redirect helper/test behavior before editing.
- Favor a single central canonicalization rule over any app-host/auth-surface workaround.
- Verify both automated redirect coverage and the real runtime/browser behavior against port 3000.

## State

- Startup context loaded; initialization completed.
- Baseline validation passed. Live inspection shows port 3000 is serving the current worktree dev runtime, but curl still reports a relative redirect for app-host guest routes.

## Done

- Activated required `mission-worker-base` and `guest-routing-worker` skills.
- Read root and mission `AGENTS.md`, mission docs, `.factory/services.yaml`, feature list, guest-route guidance, and current continuity state.
- Confirmed the feature belongs to the `guest-foundation-and-route-ownership` milestone and that the service manifest points `web` to `pnpm dev` on port 3000.
- Confirmed the full Vitest baseline passes.
- Verified via process inspection and dev trace evidence that port 3000 is serving the current worktree, not another checkout.

## Now

- Compare the live curl/browser behavior against Next dev runtime logs to determine whether host canonicalization is being normalized after proxy execution.

## Next

- Verify the real browser destination on the current runtime and decide whether any code change is still necessary versus documenting a dev-runtime header quirk.

## Open questions (UNCONFIRMED if needed)

- Whether the remaining failure is caused by stale dev runtime output, host normalization in Next dev, or a proxy/auth handoff path bypassing the intended canonical redirect.
- Whether no code change is needed beyond ensuring the worktree runtime is actually serving current middleware logic. (UNCONFIRMED)

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `src/proxy.ts`
- `tests/guest/public-booking-redirects.test.ts`
- `.factory/services.yaml`
- `npx vitest run --maxWorkers=9`
- `curl -I -H 'Host: app.localhost:3000' 'http://127.0.0.1:3000/guest/bookings?tab=upcoming'`
