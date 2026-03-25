---
name: guest-routing-worker
description: Implement guest route ownership, redirect safety, recovery flows, and canonical URL behavior for the guest design-system mission.
---

# Guest Routing Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for guest-facing work centered on:

- route ownership and canonicalization
- guest/public/auth/app host handoff rules
- `redirectedFrom` sanitization
- recovery and token normalization
- thank-you / receipt / alias redirects
- auth callback error handling and signed-in route handoff

Use this skill when the primary risk is broken navigation, wrong destination ownership, or unsafe redirect behavior.

## Required Skills

- `Style Principles` — invoke before implementing route logic so redirect/canonicalization code stays simple, centralized, and non-duplicative.
- `agent-browser` — invoke for manual verification of live redirect and canonicalization behavior.

## Work Procedure

1. Read `mission.md`, mission `AGENTS.md`, `.factory/library/guest-routes.md`, `.factory/library/environment.md`, and `.factory/library/user-testing.md`.
2. Identify the single source of truth for the behavior before editing:
   - route files under `src/app/**`
   - redirect/auth helpers under `lib/**`
   - host ownership logic in `src/proxy.ts`
3. Invoke `Style Principles` and simplify the route logic plan before coding. Prefer one central rule over multiple duplicated conditions.
4. Write tests first (RED):
   - route/unit tests in `tests/guest/**` or `tests/server/**`
   - Playwright guest-flow tests when the user-visible redirect/canonical path changes; if the mission reuses the live port-3000 app, use the documented harness mode instead of starting a separate default test server
   - confirm the new or updated test fails before implementation
5. Implement the route/canonicalization change. Preserve safe query parameters only; never widen redirect acceptance beyond the approved guest/public/app paths.
6. Run targeted tests until green, then run:
   - `npx vitest run --maxWorkers=9`
   - `pnpm typecheck`
   - `pnpm lint`
7. Use `agent-browser` to verify final URL, visible destination, and redirect continuity on the real browser surface when the runtime supports it.
8. For `VAL-FOUNDATION-013` and other multi-host guest/app canonicalization checks, treat the mission-documented local Next.js dev `app.localhost` redirect loop as a possible runtime limitation, not automatic proof of a product bug. If the live check remains blocked after confirming the worktree runtime is current, capture the browser/curl symptom, verify the canonical contract with deterministic automated coverage, and return the limitation in the handoff instead of claiming a live-runtime fix.
9. Commit only your feature changes in the isolated worktree. If the existing product code already satisfies the assigned behavior, validated test-only or harness/config coverage updates are still acceptable feature output and should be committed rather than returned as partial work.

## Example Handoff

```json
{
  "salientSummary": "Implemented canonical guest/app host ownership and safe sign-in redirect handling. Added failing tests first for root-host /app redirects and guest-route app-host bounce-back, then verified the final URL behavior in the browser where the local runtime supported it.",
  "whatWasImplemented": "Centralized guest route ownership so guest-owned paths opened on the app host redirect back to the guest/root host, root-host /app paths canonicalize to the app host, and guest sign-in only accepts validated redirectedFrom targets while preserving safe query intent.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npx vitest run tests/guest/public-booking-redirects.test.ts --reporter=verbose",
        "exitCode": 1,
        "observation": "RED confirmed before implementation because the new canonical redirect expectation failed."
      },
      {
        "command": "npx vitest run tests/guest/public-booking-redirects.test.ts --reporter=verbose",
        "exitCode": 0,
        "observation": "Targeted redirect tests passed after implementing canonicalization."
      },
      {
        "command": "npx vitest run --maxWorkers=9",
        "exitCode": 0,
        "observation": "Full Vitest suite passed."
      },
      {
        "command": "pnpm typecheck",
        "exitCode": 0,
        "observation": "TypeScript clean."
      },
      {
        "command": "pnpm lint",
        "exitCode": 0,
        "observation": "Lint passed."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Opened a protected guest route while signed out and observed the sign-in redirect.",
        "observed": "The browser landed on /auth/signin with the expected safe redirectedFrom value preserved."
      },
      {
        "action": "Opened a canonicalized legacy booking or thank-you route in the browser.",
        "observed": "The final URL resolved to the canonical guest/public destination without preserving deprecated path ownership."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/guest/public-booking-redirects.test.ts",
        "cases": [
          {
            "name": "canonicalizes legacy manage route to booking detail",
            "verifies": "Deprecated manage URLs do not remain first-class destinations."
          },
          {
            "name": "canonicalizes legacy thank-you route to guest receipt",
            "verifies": "Legacy thank-you URLs land on the canonical receipt destination."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The runtime environment cannot exercise a required host/canonicalization flow and deterministic automated coverage would not be enough.
- A route/canonicalization fix would require schema changes, external credentials, or off-limits host/process changes.
- Guest/public/app ownership rules conflict in a way that requires a product-level decision.
- The feature depends on a page-level guest UI convergence change that is not yet implemented and blocks correct verification of the final destination.
